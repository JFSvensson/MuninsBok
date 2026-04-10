/**
 * Authentication routes: register, login, refresh, logout, me.
 *
 * POST /api/auth/register  — create a new user account
 * POST /api/auth/login     — authenticate with email + password
 * POST /api/auth/refresh   — exchange a refresh token for new token pair
 * POST /api/auth/logout    — revoke all refresh tokens (server-side logout)
 * GET  /api/auth/me        — get current user info (requires access token)
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { registerSchema, loginSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import { hashPassword, verifyPassword, needsRehash } from "../utils/password.js";
import type { JwtPayload, GeneratedTokens } from "../plugins/jwt-auth.js";

const REFRESH_COOKIE = "refresh_token";

export async function authRoutes(fastify: FastifyInstance) {
  const userRepo = fastify.repos.users;
  const refreshTokenRepo = fastify.repos.refreshTokens;

  /** Max failed login attempts before lockout. */
  const MAX_LOGIN_ATTEMPTS = 5;
  /** Lockout duration in minutes. */
  const LOCKOUT_MINUTES = 15;

  /** Set the refresh token as an httpOnly cookie on the reply. */
  function setRefreshCookie(reply: FastifyReply, tokens: GeneratedTokens): void {
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict",
      path: "/api/auth",
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  /** Clear the refresh token cookie. */
  function clearRefreshCookie(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict",
      path: "/api/auth",
    });
  }

  /** Persist a refresh token in the database for later revocation. */
  async function storeRefreshToken(userId: string, jti: string, expiresAt: Date): Promise<void> {
    await refreshTokenRepo.create(userId, jti, expiresAt);
  }

  // ── Register ────────────────────────────────────────────────
  fastify.post(
    "/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { email, name, password } = parseBody(registerSchema, request.body);

      const passwordHash = await hashPassword(password);

      const result = await userRepo.create({ email, name, passwordHash });
      if (!result.ok) {
        const status = result.error.code === "EMAIL_TAKEN" ? 409 : 400;
        return reply.status(status).send({
          error: result.error.message,
          code: result.error.code,
        });
      }

      const user = result.value;
      const tokens = fastify.generateTokens(user.id, user.email);
      await storeRefreshToken(user.id, tokens.refreshTokenJti, tokens.refreshTokenExpiresAt);

      setRefreshCookie(reply, tokens);
      return reply.status(201).send({
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          accessToken: tokens.accessToken,
        },
      });
    },
  );

  // ── Login ───────────────────────────────────────────────────
  fastify.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { email, password } = parseBody(loginSchema, request.body);

      const user = await userRepo.findByEmail(email);
      if (!user) {
        return reply.status(401).send({
          error: "Felaktig e-postadress eller lösenord",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Check account lockout
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
        return reply.status(429).send({
          error: `Kontot är låst. Försök igen om ${minutesLeft} minut${minutesLeft === 1 ? "" : "er"}.`,
          code: "ACCOUNT_LOCKED",
        });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        await userRepo.recordFailedLogin(user.id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES);
        return reply.status(401).send({
          error: "Felaktig e-postadress eller lösenord",
          code: "INVALID_CREDENTIALS",
        });
      }

      const tokens = fastify.generateTokens(user.id, user.email);
      await userRepo.resetFailedLogins(user.id);

      // Rehash with stronger algorithm if using legacy v1 format
      if (needsRehash(user.passwordHash)) {
        const newHash = await hashPassword(password);
        await userRepo.updatePasswordHash(user.id, newHash);
      }

      await storeRefreshToken(user.id, tokens.refreshTokenJti, tokens.refreshTokenExpiresAt);

      setRefreshCookie(reply, tokens);
      return reply.send({
        data: {
          user: { id: user.id, email: user.email, name: user.name },
          accessToken: tokens.accessToken,
        },
      });
    },
  );

  // ── Refresh ─────────────────────────────────────────────────
  fastify.post("/refresh", { preHandler: [fastify.verifyRefreshToken] }, async (request, reply) => {
    const { sub, email, jti } = request.user as JwtPayload;

    // Atomically verify and revoke the refresh token to prevent reuse
    if (!jti || !(await refreshTokenRepo.revokeByJtiIfExists(jti))) {
      return reply.status(401).send({
        error: "Refresh-token har återkallats",
        code: "TOKEN_REVOKED",
      });
    }

    // Issue new token pair
    const tokens = fastify.generateTokens(sub, email);
    await storeRefreshToken(sub, tokens.refreshTokenJti, tokens.refreshTokenExpiresAt);

    setRefreshCookie(reply, tokens);
    return reply.send({
      data: {
        accessToken: tokens.accessToken,
      },
    });
  });

  // ── Logout ──────────────────────────────────────────────────
  fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as JwtPayload;
    await refreshTokenRepo.revokeAllByUserId(sub);
    clearRefreshCookie(reply);
    return reply.status(204).send();
  });

  // ── Me ──────────────────────────────────────────────────────
  fastify.get("/me", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { sub } = request.user as JwtPayload;
    const user = await userRepo.findById(sub);

    if (!user) {
      return reply.status(404).send({
        error: "Användaren hittades inte",
        code: "USER_NOT_FOUND",
      });
    }

    return {
      data: { id: user.id, email: user.email, name: user.name },
    };
  });
}
