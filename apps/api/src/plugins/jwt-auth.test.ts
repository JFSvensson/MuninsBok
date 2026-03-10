import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "./jwt-auth.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("jwt-auth plugin", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const result = await buildTestApp(undefined, { jwtSecret: TEST_SECRET });
    app = result.app;

    // Protected test route
    app.get("/test/protected", { preHandler: [app.authenticate] }, async (request) => {
      return { userId: (request.user as JwtPayload).sub };
    });

    // Refresh test route
    app.post("/test/refresh", { preHandler: [app.verifyRefreshToken] }, async (request) => {
      return { userId: (request.user as JwtPayload).sub };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("generateTokens returns access and refresh tokens", () => {
    const tokens = app.generateTokens("user-1", "test@example.com");

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });

  it("authenticate allows valid access token", async () => {
    const { accessToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: "user-1" });
  });

  it("authenticate rejects missing token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("authenticate rejects refresh token used as access token", async () => {
    const { refreshToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: `Bearer ${refreshToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "INVALID_TOKEN_TYPE" });
  });

  it("authenticate rejects expired token", async () => {
    // Sign a token with exp set to 60 seconds in the past
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const token = app.jwt.sign({
      sub: "user-1",
      email: "a@b.com",
      type: "access",
      iat: expiredAt - 60,
      exp: expiredAt,
    } as unknown as JwtPayload);

    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("verifyRefreshToken allows valid refresh token in cookie", async () => {
    const { refreshToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/test/refresh",
      cookies: { refresh_token: refreshToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: "user-1" });
  });

  it("verifyRefreshToken rejects access token in cookie", async () => {
    const { accessToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/test/refresh",
      cookies: { refresh_token: accessToken },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "INVALID_TOKEN_TYPE" });
  });

  it("verifyRefreshToken rejects missing cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/test/refresh",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: { authorization: "Bearer not.a.valid.token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
