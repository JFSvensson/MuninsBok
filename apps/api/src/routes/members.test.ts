import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

const JWT_SECRET = "test-secret-that-is-long-enough-for-jwt";

const MEMBER = {
  id: "mem-1",
  userId: "user-2",
  organizationId: "org-1",
  role: "MEMBER" as const,
  createdAt: new Date("2024-06-01"),
  user: { id: "user-2", name: "Anna Svensson", email: "anna@example.com" },
};

const ADMIN_MEMBER = {
  id: "mem-2",
  userId: "user-3",
  organizationId: "org-1",
  role: "ADMIN" as const,
  createdAt: new Date("2024-05-01"),
  user: { id: "user-3", name: "Erik Johansson", email: "erik@example.com" },
};

const ADMIN_MEMBERSHIP = {
  id: "mem-owner",
  userId: "user-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
  createdAt: new Date(),
};

const OWNER_MEMBERSHIP = {
  ...ADMIN_MEMBERSHIP,
  role: "OWNER" as const,
};

describe("Member routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;
  let token: string;

  beforeAll(async () => {
    const ctx = await buildTestApp(undefined, { jwtSecret: JWT_SECRET });
    app = ctx.app;
    repos = ctx.repos;
    await app.ready();

    const tokens = app.generateTokens("user-1", "owner@example.com");
    token = tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function authHeaders() {
    return { authorization: `Bearer ${token}` };
  }

  // ---------- GET /:orgId/members ----------
  describe("GET /api/organizations/:orgId/members", () => {
    it("returns all members of the organization", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.findMembersByOrganization.mockResolvedValueOnce([MEMBER, ADMIN_MEMBER]);

      const res = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(2);
      expect(repos.users.findMembersByOrganization).toHaveBeenCalledWith("org-1");
    });

    it("returns empty array when no members", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.findMembersByOrganization.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "GET",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
    });
  });

  // ---------- POST /:orgId/members ----------
  describe("POST /api/organizations/:orgId/members", () => {
    it("adds a member successfully", async () => {
      repos.users.findMembership
        .mockResolvedValueOnce(ADMIN_MEMBERSHIP) // requireMembership
        .mockResolvedValueOnce(null); // route: check user isn't already member
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-2",
        email: "anna@example.com",
        name: "Anna",
      });
      repos.users.addMember.mockResolvedValueOnce(MEMBER);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "MEMBER" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.role).toBe("MEMBER");
      expect(repos.users.addMember).toHaveBeenCalledWith("user-2", "org-1", "MEMBER");
    });

    it("returns 404 when user not found", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.findByEmail.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "unknown@example.com", role: "MEMBER" },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).code).toBe("USER_NOT_FOUND");
    });

    it("returns 409 when user is already a member", async () => {
      repos.users.findMembership
        .mockResolvedValueOnce(ADMIN_MEMBERSHIP) // requireMembership
        .mockResolvedValueOnce(MEMBER); // route: existing membership
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-2",
        email: "anna@example.com",
        name: "Anna",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "MEMBER" },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).code).toBe("ALREADY_MEMBER");
    });

    it("returns 400 when email is missing", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { role: "MEMBER" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when role is invalid", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "SUPERADMIN" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when user is MEMBER (not ADMIN)", async () => {
      repos.users.findMembership.mockResolvedValueOnce({
        ...ADMIN_MEMBERSHIP,
        role: "MEMBER" as const,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "MEMBER" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 403 when ADMIN tries to assign OWNER role", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "OWNER" },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).code).toBe("INSUFFICIENT_ROLE_ASSIGNMENT");
    });

    it("allows OWNER to assign OWNER role", async () => {
      repos.users.findMembership
        .mockResolvedValueOnce(OWNER_MEMBERSHIP) // requireMembership
        .mockResolvedValueOnce(null); // route: check user isn't already member
      repos.users.findByEmail.mockResolvedValueOnce({
        id: "user-2",
        email: "anna@example.com",
        name: "Anna",
      });
      repos.users.addMember.mockResolvedValueOnce({ ...MEMBER, role: "OWNER" });

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/members",
        headers: authHeaders(),
        payload: { email: "anna@example.com", role: "OWNER" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.role).toBe("OWNER");
    });
  });

  // ---------- PATCH /:orgId/members/:userId ----------
  describe("PATCH /api/organizations/:orgId/members/:userId", () => {
    it("updates a member role", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.updateMemberRole.mockResolvedValueOnce({ ...MEMBER, role: "ADMIN" });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-2",
        headers: authHeaders(),
        payload: { role: "ADMIN" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.role).toBe("ADMIN");
      expect(repos.users.updateMemberRole).toHaveBeenCalledWith("user-2", "org-1", "ADMIN");
    });

    it("returns 404 when membership not found", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.updateMemberRole.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-unknown",
        headers: authHeaders(),
        payload: { role: "ADMIN" },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).code).toBe("MEMBER_NOT_FOUND");
    });

    it("returns 400 when role is invalid", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-2",
        headers: authHeaders(),
        payload: { role: "INVALID" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when ADMIN tries to promote member to OWNER", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-2",
        headers: authHeaders(),
        payload: { role: "OWNER" },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).code).toBe("INSUFFICIENT_ROLE_ASSIGNMENT");
    });

    it("allows OWNER to promote member to OWNER", async () => {
      repos.users.findMembership.mockResolvedValueOnce(OWNER_MEMBERSHIP);
      repos.users.updateMemberRole.mockResolvedValueOnce({ ...MEMBER, role: "OWNER" });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/org-1/members/user-2",
        headers: authHeaders(),
        payload: { role: "OWNER" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.role).toBe("OWNER");
    });
  });

  // ---------- DELETE /:orgId/members/:userId ----------
  describe("DELETE /api/organizations/:orgId/members/:userId", () => {
    it("removes a member", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.removeMember.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/user-2",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(204);
      expect(repos.users.removeMember).toHaveBeenCalledWith("user-2", "org-1");
    });

    it("returns 404 when membership not found", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.users.removeMember.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/organizations/org-1/members/user-unknown",
        headers: authHeaders(),
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).code).toBe("MEMBER_NOT_FOUND");
    });
  });
});
