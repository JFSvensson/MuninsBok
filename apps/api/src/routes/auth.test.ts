import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";
import { hashPassword } from "../utils/password.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("auth routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeAll(async () => {
    const result = await buildTestApp(undefined, { jwtSecret: TEST_SECRET });
    app = result.app;
    repos = result.repos;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Register ────────────────────────────────────────────────

  describe("POST /api/auth/register", () => {
    it("creates a new user and returns tokens", async () => {
      const newUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repos.users.create.mockResolvedValueOnce({ ok: true, value: newUser });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "test@example.com",
          name: "Test User",
          password: "Passw0rd!xyz",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.user).toEqual({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      });
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeUndefined();

      // Refresh token must be in httpOnly cookie
      const cookies = response.cookies as { name: string; value: string; httpOnly?: boolean }[];
      expect(cookies.find((c) => c.name === "refresh_token")).toBeDefined();
    });

    it("returns 409 when email is taken", async () => {
      repos.users.create.mockResolvedValueOnce({
        ok: false,
        error: { code: "EMAIL_TAKEN", message: "E-postadressen används redan" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "taken@example.com",
          name: "Another User",
          password: "Passw0rd!xyz",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "EMAIL_TAKEN" });
    });

    it("returns 400 for invalid input", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "not-an-email",
          name: "",
          password: "short",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── Login ───────────────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    it("returns tokens for valid credentials", async () => {
      const storedHash = await hashPassword("correct-password");

      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: storedHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "test@example.com",
          password: "correct-password",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.user.id).toBe("user-1");
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeUndefined();

      const cookies = response.cookies as { name: string; value: string }[];
      expect(cookies.find((c) => c.name === "refresh_token")).toBeDefined();
    });

    it("returns 401 for unknown email", async () => {
      repos.users.findByEmail.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "unknown@example.com",
          password: "whatever",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: "INVALID_CREDENTIALS" });
    });

    it("returns 401 for wrong password", async () => {
      const storedHash = await hashPassword("correct-password");

      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: storedHash,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "test@example.com",
          password: "wrong-password",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: "INVALID_CREDENTIALS" });
    });
  });

  // ── Refresh ─────────────────────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    it("returns new token pair for valid refresh token in cookie", async () => {
      const { refreshToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeUndefined();

      const cookies = response.cookies as { name: string; value: string }[];
      expect(cookies.find((c) => c.name === "refresh_token")).toBeDefined();
    });

    it("rejects access token used as refresh cookie", async () => {
      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        cookies: { refresh_token: accessToken },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: "INVALID_TOKEN_TYPE" });
    });

    it("rejects refresh without cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── Me ──────────────────────────────────────────────────────

  describe("GET /api/auth/me", () => {
    it("returns current user info", async () => {
      repos.users.findById.mockResolvedValueOnce({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toEqual({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      });
    });

    it("returns 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 404 if user no longer exists", async () => {
      repos.users.findById.mockResolvedValueOnce(null);

      const { accessToken } = app.generateTokens("deleted-user", "gone@example.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });
});
