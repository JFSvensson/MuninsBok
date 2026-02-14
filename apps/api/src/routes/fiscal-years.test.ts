import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import { ok, err } from "@muninsbok/core";

describe("Fiscal year routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseFy = {
    id: "fy-1",
    organizationId: orgId,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /:orgId/fiscal-years", () => {
    it("returns fiscal years for organization", async () => {
      repos.fiscalYears.findByOrganization.mockResolvedValue([baseFy]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(repos.fiscalYears.findByOrganization).toHaveBeenCalledWith(orgId);
    });

    it("returns empty array when no fiscal years", async () => {
      repos.fiscalYears.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
    });
  });

  describe("GET /:orgId/fiscal-years/:fyId", () => {
    it("returns single fiscal year", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe("fy-1");
    });

    it("returns 404 when not found", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/unknown`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /:orgId/fiscal-years", () => {
    it("creates fiscal year successfully", async () => {
      repos.fiscalYears.create.mockResolvedValue(ok(baseFy));

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "2024-01-01", endDate: "2024-12-31" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.id).toBe("fy-1");
      expect(repos.fiscalYears.create).toHaveBeenCalledWith({
        organizationId: orgId,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it("returns 400 when dates overlap", async () => {
      repos.fiscalYears.create.mockResolvedValue(
        err({ code: "OVERLAPPING_DATES" as const, message: "Overlapping fiscal year" })
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "2024-01-01", endDate: "2024-12-31" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 with invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /:orgId/fiscal-years/:fyId/close", () => {
    it("closes fiscal year successfully", async () => {
      repos.fiscalYears.close.mockResolvedValue(ok({ ...baseFy, isClosed: true }));

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1/close`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.isClosed).toBe(true);
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.fiscalYears.close.mockResolvedValue(
        err({ code: "NOT_FOUND" as const, message: "Not found" })
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/unknown/close`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when already closed", async () => {
      repos.fiscalYears.close.mockResolvedValue(
        err({ code: "ALREADY_CLOSED" as const, message: "Already closed" })
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1/close`,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
