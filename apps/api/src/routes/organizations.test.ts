import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Organization routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  describe("GET /api/organizations", () => {
    it("returns no organizations when unauthenticated", async () => {
      const orgs = [
        {
          id: "1",
          orgNumber: "5561234567",
          name: "Test AB",
          fiscalYearStartMonth: 1,
          createdAt: new Date(),
        },
        {
          id: "2",
          orgNumber: "5567654321",
          name: "Demo AB",
          fiscalYearStartMonth: 7,
          createdAt: new Date(),
        },
      ];
      repos.organizations.findAll.mockResolvedValue(orgs);

      const res = await app.inject({ method: "GET", url: "/api/organizations" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
      expect(repos.organizations.findAll).not.toHaveBeenCalled();
    });

    it("returns empty array when no organizations", async () => {
      repos.organizations.findAll.mockResolvedValue([]);

      const res = await app.inject({ method: "GET", url: "/api/organizations" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
    });
  });

  describe("GET /api/organizations/:orgId", () => {
    it("returns organization by id", async () => {
      const org = { id: "1", orgNumber: "5561234567", name: "Test AB", fiscalYearStartMonth: 1 };
      repos.organizations.findById.mockResolvedValue(org);

      const res = await app.inject({ method: "GET", url: "/api/organizations/1" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Test AB");
    });

    it("returns 404 for unknown organization", async () => {
      repos.organizations.findById.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: "/api/organizations/unknown" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/organizations", () => {
    it("creates organization and initializes BAS chart", async () => {
      const org = {
        id: "1",
        orgNumber: "5561234567",
        name: "Ny Förening",
        fiscalYearStartMonth: 1,
      };
      repos.organizations.create.mockResolvedValue({ ok: true, value: org });
      repos.accounts.createMany.mockResolvedValue(50);

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: { orgNumber: "5561234567", name: "Ny Förening" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.name).toBe("Ny Förening");
      expect(repos.accounts.createMany).toHaveBeenCalledOnce();
    });

    it("returns 400 for invalid input", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: { orgNumber: "123", name: "" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when create fails", async () => {
      repos.organizations.create.mockResolvedValue({
        ok: false,
        error: { code: "INVALID_NAME", message: "Namn måste anges" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: { orgNumber: "5561234567", name: "Test" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/organizations/:orgId", () => {
    it("returns 401 when unauthenticated", async () => {
      repos.organizations.delete.mockResolvedValue(true);

      const res = await app.inject({ method: "DELETE", url: "/api/organizations/1" });

      expect(res.statusCode).toBe(401);
      expect(repos.organizations.delete).not.toHaveBeenCalled();
    });

    it("returns 401 for unknown organization when unauthenticated", async () => {
      repos.organizations.delete.mockResolvedValue(false);

      const res = await app.inject({ method: "DELETE", url: "/api/organizations/unknown" });

      expect(res.statusCode).toBe(401);
      expect(repos.organizations.delete).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/organizations/:orgId", () => {
    it("returns 401 when unauthenticated", async () => {
      const org = {
        id: "1",
        orgNumber: "5561234567",
        name: "Uppdaterat AB",
        fiscalYearStartMonth: 1,
      };
      repos.organizations.update.mockResolvedValue(org);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        payload: { name: "Uppdaterat AB" },
      });

      expect(res.statusCode).toBe(401);
      expect(repos.organizations.update).not.toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated and changing fiscal year start month", async () => {
      const org = { id: "1", orgNumber: "5561234567", name: "Test AB", fiscalYearStartMonth: 7 };
      repos.organizations.update.mockResolvedValue(org);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        payload: { fiscalYearStartMonth: 7 },
      });

      expect(res.statusCode).toBe(401);
      expect(repos.organizations.update).not.toHaveBeenCalled();
    });

    it("returns 401 for non-existing organization when unauthenticated", async () => {
      repos.organizations.update.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/unknown",
        payload: { name: "Ny" },
      });

      expect(res.statusCode).toBe(401);
      expect(repos.organizations.update).not.toHaveBeenCalled();
    });

    it("returns 401 for invalid input when unauthenticated", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        payload: { fiscalYearStartMonth: 13 },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("Organization routes (authenticated)", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp(undefined, { jwtSecret: TEST_SECRET });
    app = ctx.app;
    repos = ctx.repos;
    await app.ready();
  });

  describe("GET /api/organizations", () => {
    it("returns only organizations where user is a member", async () => {
      const memberOrgs = [
        {
          id: "1",
          orgNumber: "5561234567",
          name: "Min Förening",
          fiscalYearStartMonth: 1,
          createdAt: new Date(),
        },
      ];
      repos.organizations.findByUserMembership.mockResolvedValue(memberOrgs);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "GET",
        url: "/api/organizations",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(1);
      expect(repos.organizations.findByUserMembership).toHaveBeenCalledWith("user-1");
      expect(repos.organizations.findAll).not.toHaveBeenCalled();
    });

    it("returns empty array when user has no memberships", async () => {
      repos.organizations.findByUserMembership.mockResolvedValue([]);

      const { accessToken } = app.generateTokens("user-2", "other@example.com");
      const res = await app.inject({
        method: "GET",
        url: "/api/organizations",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
    });
  });

  describe("POST /api/organizations", () => {
    it("auto-assigns creator as OWNER", async () => {
      const org = {
        id: "new-org",
        orgNumber: "5561234567",
        name: "Ny Förening",
        fiscalYearStartMonth: 1,
      };
      repos.organizations.create.mockResolvedValue({ ok: true, value: org });
      repos.accounts.createMany.mockResolvedValue(50);
      repos.users.addMember.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "new-org",
        role: "OWNER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { orgNumber: "5561234567", name: "Ny Förening" },
      });

      expect(res.statusCode).toBe(201);
      expect(repos.users.addMember).toHaveBeenCalledWith("user-1", "new-org", "OWNER");
    });

    it("does not call addMember when create fails", async () => {
      repos.organizations.create.mockResolvedValue({
        ok: false,
        error: { code: "INVALID_NAME", message: "Namn måste anges" },
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { orgNumber: "5561234567", name: "Test" },
      });

      expect(res.statusCode).toBe(400);
      expect(repos.users.addMember).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/organizations/:orgId", () => {
    it("updates organization when requester is OWNER", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "1",
        role: "OWNER",
        createdAt: new Date(),
      });
      repos.organizations.update.mockResolvedValue({
        id: "1",
        orgNumber: "5561234567",
        name: "Uppdaterat AB",
        fiscalYearStartMonth: 1,
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: "Uppdaterat AB" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Uppdaterat AB");
    });

    it("returns 403 when requester is not OWNER", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "1",
        role: "ADMIN",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: "Borde inte gå" },
      });

      expect(res.statusCode).toBe(403);
      expect(repos.organizations.update).not.toHaveBeenCalled();
    });

    it("returns 404 for non-existing organization", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "unknown",
        role: "OWNER",
        createdAt: new Date(),
      });
      repos.organizations.update.mockResolvedValue(null);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/unknown",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: "Ny" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid input", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "1",
        role: "OWNER",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { fiscalYearStartMonth: 13 },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/organizations/:orgId", () => {
    it("deletes organization when requester is OWNER", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "1",
        role: "OWNER",
        createdAt: new Date(),
      });
      repos.organizations.delete.mockResolvedValue(true);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "DELETE",
        url: "/api/organizations/1",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);
      expect(repos.organizations.delete).toHaveBeenCalledWith("1");
    });

    it("returns 403 when deleting as non-OWNER", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "1",
        role: "ADMIN",
        createdAt: new Date(),
      });

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "DELETE",
        url: "/api/organizations/1",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(repos.organizations.delete).not.toHaveBeenCalled();
    });

    it("returns 404 for non-existing organization", async () => {
      repos.users.findMembership.mockResolvedValue({
        id: "mem-1",
        userId: "user-1",
        organizationId: "unknown",
        role: "OWNER",
        createdAt: new Date(),
      });
      repos.organizations.delete.mockResolvedValue(false);

      const { accessToken } = app.generateTokens("user-1", "test@example.com");
      const res = await app.inject({
        method: "DELETE",
        url: "/api/organizations/unknown",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});

describe("Health check", () => {
  it("returns status ok with extended info", async () => {
    const { app } = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeTypeOf("number");
    expect(body.version).toBeDefined();
    expect(body.memory).toMatchObject({
      rss: expect.any(Number),
      heapUsed: expect.any(Number),
      heapTotal: expect.any(Number),
    });
  });
});
