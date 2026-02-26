/**
 * Authentication routes: register, login, refresh, me.
 *
 * POST /api/auth/register  — create a new user account
 * POST /api/auth/login     — authenticate with email + password
 * POST /api/auth/refresh   — exchange a refresh token for new token pair
 * GET  /api/auth/me        — get current user info (requires access token)
 */
import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import type { JwtPayload } from "../plugins/jwt-auth.js";

export async function authRoutes(fastify: FastifyInstance) {
  const userRepo = fastify.repos.users;

  // ── Register ────────────────────────────────────────────────
  fastify.post("/register", async (request, reply) => {
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

    return reply.status(201).send({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        ...tokens,
      },
    });
  });

  // ── Login ───────────────────────────────────────────────────
  fastify.post("/login", async (request, reply) => {
    const { email, password } = parseBody(loginSchema, request.body);

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return reply.status(401).send({
        error: "Felaktig e-postadress eller lösenord",
        code: "INVALID_CREDENTIALS",
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: "Felaktig e-postadress eller lösenord",
        code: "INVALID_CREDENTIALS",
      });
    }

    const tokens = fastify.generateTokens(user.id, user.email);

    return {
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        ...tokens,
      },
    };
  });

  // ── Refresh ─────────────────────────────────────────────────
  fastify.post(
    "/refresh",
    { preHandler: [fastify.verifyRefreshToken] },
    async (request) => {
      const { sub, email } = request.user as JwtPayload;
      const tokens = fastify.generateTokens(sub, email);
      return { data: tokens };
    },
  );

  // ── Me ──────────────────────────────────────────────────────
  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
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
    },
  );
}
