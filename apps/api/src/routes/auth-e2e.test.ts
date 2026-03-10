/**
 * End-to-end auth flow tests.
 *
 * Unlike the unit-level auth.test.ts that tests individual endpoints in
 * isolation, these tests chain multiple operations to verify the complete
 * authentication lifecycle:
 *
 *  - Register → use access token → refresh → use new tokens → /me
 *  - Login with registered credentials
 *  - Token cross-use prevention (access ↔ refresh)
 *  - Protected route rejection without valid token
 *  - Token expiry and session flow
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";
import { hashPassword } from "../utils/password.js";
import type { JwtPayload } from "../plugins/jwt-auth.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("auth E2E flow", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  const testUser = {
    id: "user-e2e",
    email: "e2e@example.com",
    name: "E2E User",
    passwordHash: "will-be-set",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const result = await buildTestApp(undefined, { jwtSecret: TEST_SECRET });
    app = result.app;
    repos = result.repos;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("register → access → refresh → access", () => {
    let accessToken: string;
    let refreshCookie: string;

    it("step 1: registers a new user and receives tokens", async () => {
      repos.users.create.mockResolvedValueOnce({
        ok: true,
        value: testUser,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: testUser.email,
          name: testUser.name,
          password: "secure-password-123",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.user.id).toBe(testUser.id);
      expect(body.data.user.email).toBe(testUser.email);
      expect(body.data.user.name).toBe(testUser.name);
      // Access token in body, refresh token in httpOnly cookie
      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.refreshToken).toBeUndefined();

      // Refresh token must be in Set-Cookie header
      const cookies = res.cookies as {
        name: string;
        value: string;
        httpOnly?: boolean;
        path?: string;
      }[];
      const rtCookie = cookies.find((c) => c.name === "refresh_token");
      expect(rtCookie).toBeDefined();
      expect(rtCookie!.httpOnly).toBe(true);
      expect(rtCookie!.path).toBe("/api/auth");

      accessToken = body.data.accessToken;
      refreshCookie = `refresh_token=${rtCookie!.value}`;
    });

    it("step 2: uses access token to call /me", async () => {
      repos.users.findById.mockResolvedValueOnce(testUser);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      });
    });

    it("step 3: refreshes tokens via cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshCookie.split("=")[1]! },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.refreshToken).toBeUndefined();

      // New refresh token in cookie
      const cookies = res.cookies as { name: string; value: string }[];
      const rtCookie = cookies.find((c) => c.name === "refresh_token");
      expect(rtCookie).toBeDefined();

      accessToken = body.data.accessToken;
      refreshCookie = `refresh_token=${rtCookie!.value}`;
    });

    it("step 4: uses refreshed access token to call /me", async () => {
      repos.users.findById.mockResolvedValueOnce(testUser);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(testUser.id);
    });
  });

  describe("login → access → /me", () => {
    let accessToken: string;

    it("step 1: logs in with valid credentials", async () => {
      const hash = await hashPassword("my-password");

      repos.users.findByEmail.mockResolvedValueOnce({
        ...testUser,
        passwordHash: hash,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testUser.email,
          password: "my-password",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.user.id).toBe(testUser.id);
      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.refreshToken).toBeUndefined();

      // Refresh token in cookie
      const cookies = res.cookies as { name: string; value: string }[];
      const rtCookie = cookies.find((c) => c.name === "refresh_token");
      expect(rtCookie).toBeDefined();

      accessToken = body.data.accessToken;
    });

    it("step 2: accesses /me with login-issued token", async () => {
      repos.users.findById.mockResolvedValueOnce(testUser);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe(testUser.email);
    });
  });

  describe("token cross-use prevention", () => {
    it("rejects refresh token used as access token on /me", async () => {
      const { refreshToken } = app.generateTokens(testUser.id, testUser.email);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${refreshToken}` },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("INVALID_TOKEN_TYPE");
    });

    it("rejects access token used as refresh cookie", async () => {
      const { accessToken } = app.generateTokens(testUser.id, testUser.email);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: accessToken },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("INVALID_TOKEN_TYPE");
    });
  });

  describe("protected route rejection", () => {
    it("rejects /me without any token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects /me with an invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: "Bearer not.a.valid.jwt" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects /me with malformed Authorization header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: "InvalidFormat" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("expired token handling", () => {
    it("rejects an expired access token", async () => {
      // Sign a token with exp already in the past
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = app.jwt.sign({
        sub: testUser.id,
        email: testUser.email,
        type: "access",
        iat: now - 120,
        exp: now - 60,
      } as unknown as JwtPayload);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("UNAUTHORIZED");
    });

    it("rejects an expired refresh token in cookie", async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredRefresh = app.jwt.sign({
        sub: testUser.id,
        email: testUser.email,
        type: "refresh",
        iat: now - 120,
        exp: now - 60,
      } as unknown as JwtPayload);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: expiredRefresh },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("UNAUTHORIZED");
    });
  });

  describe("login failure scenarios", () => {
    it("rejects login for non-existent user", async () => {
      repos.users.findByEmail.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "nobody@example.com",
          password: "whatever",
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects login with wrong password then succeeds with correct one", async () => {
      const hash = await hashPassword("correct-password");

      // Attempt with wrong password
      repos.users.findByEmail.mockResolvedValueOnce({
        ...testUser,
        passwordHash: hash,
      });

      const failRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testUser.email,
          password: "wrong-password",
        },
      });

      expect(failRes.statusCode).toBe(401);

      // Now succeed with correct password
      repos.users.findByEmail.mockResolvedValueOnce({
        ...testUser,
        passwordHash: hash,
      });

      const okRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: testUser.email,
          password: "correct-password",
        },
      });

      expect(okRes.statusCode).toBe(200);
      expect(okRes.json().data.accessToken).toEqual(expect.any(String));
    });
  });

  describe("register validation", () => {
    it("rejects registration with invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "not-an-email",
          name: "Test",
          password: "password123",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects registration with short password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "valid@example.com",
          name: "Test",
          password: "abc",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects registration with empty name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "valid@example.com",
          name: "",
          password: "password123",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects registration with duplicate email", async () => {
      repos.users.create.mockResolvedValueOnce({
        ok: false,
        error: { code: "EMAIL_TAKEN", message: "E-postadressen används redan" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "taken@example.com",
          name: "Existing",
          password: "password123",
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe("EMAIL_TAKEN");
    });
  });

  describe("token signed with different secret", () => {
    let otherApp: FastifyInstance;

    beforeAll(async () => {
      const result = await buildTestApp(undefined, {
        jwtSecret: "another-secret-that-is-completely-different",
      });
      otherApp = result.app;
      await otherApp.ready();
    });

    afterAll(async () => {
      await otherApp.close();
    });

    it("rejects a token signed with a different secret", async () => {
      const { accessToken } = otherApp.generateTokens(testUser.id, testUser.email);

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("token revocation + logout", () => {
    it("rejects refresh when token has been revoked", async () => {
      const { refreshToken } = app.generateTokens(testUser.id, testUser.email);

      // Mark the jti as revoked (existsByJti returns false)
      repos.refreshTokens.existsByJti.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe("TOKEN_REVOKED");
    });

    it("logout revokes all tokens and returns 204", async () => {
      const { accessToken } = app.generateTokens(testUser.id, testUser.email);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);
      expect(repos.refreshTokens.revokeAllByUserId).toHaveBeenCalledWith(testUser.id);
    });

    it("logout requires authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(res.statusCode).toBe(401);
    });

    it("refresh rotates tokens (revokes old, creates new)", async () => {
      const { refreshToken } = app.generateTokens(testUser.id, testUser.email);

      repos.refreshTokens.existsByJti.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.accessToken).toEqual(expect.any(String));
      expect(body.data.refreshToken).toBeUndefined();

      // New refresh token in cookie
      const cookies = res.cookies as { name: string; value: string }[];
      expect(cookies.find((c) => c.name === "refresh_token")).toBeDefined();

      // Old jti should have been revoked
      expect(repos.refreshTokens.revokeByJti).toHaveBeenCalled();
      // New token should have been stored
      expect(repos.refreshTokens.create).toHaveBeenCalled();
    });
  });
});
