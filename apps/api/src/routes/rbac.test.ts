import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("RBAC + org membership", () => {
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

  // ── Membership required ─────────────────────────────────────

  describe("org membership check", () => {
    it("returns 403 when user is not a member", async () => {
      repos.users.findMembership.mockResolvedValueOnce(null);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows access when user is a member", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ── List members ────────────────────────────────────────────

  describe("GET /:orgId/members", () => {
    it("returns member list for org members", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });
      repos.users.findMembersByOrganization.mockResolvedValueOnce([
        {
          id: "mem-1",
          userId: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          createdAt: new Date(),
          user: { id: "user-1", email: "test@example.com", name: "Test" },
        },
      ]);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveLength(1);
    });
  });

  // ── Add member ──────────────────────────────────────────────

  describe("POST /:orgId/members", () => {
    it("allows ADMIN to add a member", async () => {
      // requireMembership
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      // findByEmail for the new member
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-2",
        email: "new@example.com",
        name: "New User",
        passwordHash: "hash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // findMembership check (not already a member)
      repos.users.findMembership.mockResolvedValueOnce(null);
      // addMember
      repos.users.addMember.mockResolvedValueOnce({
        id: "mem-2",
        userId: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { email: "new@example.com" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.userId).toBe("user-2");
    });

    it("returns 403 when MEMBER tries to add", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { email: "new@example.com" },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "INSUFFICIENT_ROLE" });
    });

    it("returns 409 when user is already a member", async () => {
      // requireMembership — caller is ADMIN
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-2",
        email: "existing@example.com",
        name: "Existing",
        passwordHash: "hash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Already a member
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-2",
        userId: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { email: "existing@example.com" },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "ALREADY_MEMBER" });
    });

    it("returns 404 when user email not found", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      repos.users.findByEmail.mockResolvedValueOnce(null);

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { email: "nobody@example.com" },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });

  // ── Update member role ──────────────────────────────────────

  describe("PATCH /:orgId/members/:userId", () => {
    it("allows ADMIN to change a member role", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-2",
        userId: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });
      // updateMemberRole returns the updated membership atomically
      repos.users.updateMemberRole.mockResolvedValueOnce({
        id: "mem-3",
        userId: "user-2",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-2",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { role: "ADMIN" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.role).toBe("ADMIN");
    });
  });

  // ── Remove member ───────────────────────────────────────────

  describe("DELETE /:orgId/members/:userId", () => {
    it("allows ADMIN to remove a member", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-2",
        userId: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });
      repos.users.removeMember.mockResolvedValueOnce(true);

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/user-2",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it("returns 404 when membership not found", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "admin-1",
        organizationId: "org-1",
        role: "ADMIN",
        createdAt: new Date(),
      });
      repos.users.removeMember.mockResolvedValueOnce(false);

      const { accessToken } = app.generateTokens("admin-1", "admin@example.com");

      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/user-2",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 403 when MEMBER tries to remove", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");

      const response = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/user-2",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: "INSUFFICIENT_ROLE" });
    });
  });

  // ── OWNER role ──────────────────────────────────────────────

  describe("OWNER privileges", () => {
    it("OWNER can add members", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        id: "mem-1",
        userId: "owner-1",
        organizationId: "org-1",
        role: "OWNER",
        createdAt: new Date(),
      });
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-3",
        email: "new@example.com",
        name: "New User",
        passwordHash: "hash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repos.users.findMembership.mockResolvedValueOnce(null);
      repos.users.addMember.mockResolvedValueOnce({
        id: "mem-4",
        userId: "user-3",
        organizationId: "org-1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("owner-1", "owner@example.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { email: "new@example.com" },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});
