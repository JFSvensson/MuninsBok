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
    it("returns all organizations", async () => {
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
      expect(JSON.parse(res.body).data).toHaveLength(2);
      expect(repos.organizations.findAll).toHaveBeenCalledOnce();
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
    it("deletes organization", async () => {
      repos.organizations.delete.mockResolvedValue(true);

      const res = await app.inject({ method: "DELETE", url: "/api/organizations/1" });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 for non-existing organization", async () => {
      repos.organizations.delete.mockResolvedValue(false);

      const res = await app.inject({ method: "DELETE", url: "/api/organizations/unknown" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/organizations/:orgId", () => {
    it("updates organization name", async () => {
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

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Uppdaterat AB");
    });

    it("updates fiscal year start month", async () => {
      const org = { id: "1", orgNumber: "5561234567", name: "Test AB", fiscalYearStartMonth: 7 };
      repos.organizations.update.mockResolvedValue(org);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        payload: { fiscalYearStartMonth: 7 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.fiscalYearStartMonth).toBe(7);
    });

    it("returns 404 for non-existing organization", async () => {
      repos.organizations.update.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/unknown",
        payload: { name: "Ny" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid input", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/organizations/1",
        payload: { fiscalYearStartMonth: 13 },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

describe("Health check", () => {
  it("returns status ok", async () => {
    const { app } = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
