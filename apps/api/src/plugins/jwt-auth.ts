/**
 * JWT authentication plugin.
 *
 * Wraps @fastify/jwt to provide:
 * - Access tokens  (short-lived, default 15 min)
 * - Refresh tokens (long-lived, default 7 days, tracked with jti for revocation)
 * - `authenticate` request decorator (preHandler)
 *
 * Token payload shape: { sub: string; email: string; type: "access" | "refresh"; jti?: string }
 *
 * Usage in routes:
 *   fastify.get("/me", { preHandler: [fastify.authenticate] }, handler)
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";

export interface JwtPayload {
  /** User id */
  sub: string;
  /** User email */
  email: string;
  /** Token type to prevent cross-use */
  type: "access" | "refresh";
  /** Unique token id (present on refresh tokens, for server-side revocation) */
  jti?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Extended result that includes jti + expiresAt so callers can persist the token. */
export interface GeneratedTokens extends AuthTokens {
  /** The unique identifier of the refresh token (for DB storage). */
  refreshTokenJti: string;
  /** When the refresh token expires. */
  refreshTokenExpiresAt: Date;
}

export interface JwtAuthOptions {
  /** Secret key for signing tokens. Must be ≥ 32 chars in production. */
  secret: string;
  /** Access token TTL (default: "15m") */
  accessTokenTtl?: string;
  /** Refresh token TTL (default: "7d") */
  refreshTokenTtl?: string;
}

/** Parse a simple duration string like "15m", "7d", "1h" into milliseconds. */
function parseDurationMs(dur: string): number {
  const match = dur.match(/^(\d+)\s*([smhd])$/);
  if (!match) throw new Error(`Invalid duration: ${dur}`);
  const n = Number(match[1]);
  switch (match[2]) {
    case "s":
      return n * 1_000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      throw new Error(`Unknown unit: ${match[2]}`);
  }
}

async function jwtAuth(fastify: FastifyInstance, options: JwtAuthOptions): Promise<void> {
  const accessTtl = options.accessTokenTtl ?? "15m";
  const refreshTtl = options.refreshTokenTtl ?? "7d";
  const refreshTtlMs = parseDurationMs(refreshTtl);

  await fastify.register(jwt, {
    secret: options.secret,
  });

  /** Generate an access + refresh token pair for a user. */
  fastify.decorate("generateTokens", function (userId: string, email: string): GeneratedTokens {
    const jti = randomUUID();

    const accessToken = fastify.jwt.sign(
      { sub: userId, email, type: "access" } satisfies JwtPayload,
      { expiresIn: accessTtl },
    );
    const refreshToken = fastify.jwt.sign(
      { sub: userId, email, type: "refresh", jti } satisfies JwtPayload,
      { expiresIn: refreshTtl },
    );
    return {
      accessToken,
      refreshToken,
      refreshTokenJti: jti,
      refreshTokenExpiresAt: new Date(Date.now() + refreshTtlMs),
    };
  });

  /** PreHandler that verifies an access token and sets request.user. */
  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify<JwtPayload>();

      if (decoded.type !== "access") {
        return reply.status(401).send({
          error: "Ogiltig tokentyp",
          code: "INVALID_TOKEN_TYPE",
        });
      }

      // Attach user info for downstream handlers
      request.user = decoded;
    } catch {
      return reply.status(401).send({
        error: "Ogiltig eller utgången token",
        code: "UNAUTHORIZED",
      });
    }
  });

  /**
   * PreHandler that verifies a refresh token (for the /auth/refresh endpoint).
   * Sets request.user with the refresh token payload.
   */
  fastify.decorate(
    "verifyRefreshToken",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = await request.jwtVerify<JwtPayload>();

        if (decoded.type !== "refresh") {
          return reply.status(401).send({
            error: "Ogiltig tokentyp — förväntade refresh-token",
            code: "INVALID_TOKEN_TYPE",
          });
        }

        request.user = decoded;
      } catch {
        return reply.status(401).send({
          error: "Ogiltig eller utgången refresh-token",
          code: "UNAUTHORIZED",
        });
      }
    },
  );
}

export default fp(jwtAuth, { name: "jwt-auth" });

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    generateTokens: (userId: string, email: string) => GeneratedTokens;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyRefreshToken: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
