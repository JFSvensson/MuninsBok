import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { ok, err } from "@muninsbok/core/types";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Budget routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseUrl = `/api/organizations/${orgId}/budgets`;

  const sampleBudget = {
    id: "budget-1",
    organizationId: orgId,
    fiscalYearId: "fy-1",
    name: "Budget 2024",
    entries: [
      { id: "be-1", budgetId: "budget-1", accountNumber: "3010", month: 1, amount: 100000 },
      { id: "be-2", budgetId: "budget-1", accountNumber: "5010", month: 1, amount: -50000 },
    ],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  // ── GET /:orgId/budgets ───────────────────────────────────

  describe("GET /:orgId/budgets", () => {
    it("returns budgets for a fiscal year", async () => {
      repos.budgets.findByFiscalYear.mockResolvedValue([sampleBudget]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}?fiscalYearId=fy-1`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Budget 2024");
    });

    it("returns empty list when no budgets exist", async () => {
      repos.budgets.findByFiscalYear.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}?fiscalYearId=fy-1`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(0);
    });

    it("returns 400 without fiscalYearId", async () => {
      const res = await app.inject({
        method: "GET",
        url: baseUrl,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /:orgId/budgets/:budgetId ────────────────────────

  describe("GET /:orgId/budgets/:budgetId", () => {
    it("returns budget by id", async () => {
      repos.budgets.findById.mockResolvedValue(sampleBudget);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/budget-1`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Budget 2024");
    });

    it("returns 404 for non-existent budget", async () => {
      repos.budgets.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/missing`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /:orgId/budgets ─────────────────────────────────

  describe("POST /:orgId/budgets", () => {
    const validPayload = {
      fiscalYearId: "d4f1b2c3-a456-4890-a234-567890abcdef",
      name: "Ny budget",
      entries: [
        { accountNumber: "3010", month: 1, amount: 100000 },
        { accountNumber: "5010", month: 1, amount: -50000 },
      ],
    };

    it("creates a budget and returns 201", async () => {
      repos.budgets.create.mockResolvedValue(ok(sampleBudget));

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.name).toBe("Budget 2024");
      expect(repos.budgets.create).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({ name: "Ny budget" }),
      );
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.budgets.create.mockResolvedValue(
        err({ code: "NOT_FOUND" as const, message: "Räkenskapsår hittades inte" }),
      );

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 on duplicate name", async () => {
      repos.budgets.create.mockResolvedValue(
        err({ code: "DUPLICATE_NAME" as const, message: "Finns redan" }),
      );

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "d4f1b2c3-a456-4890-a234-567890abcdef",
          entries: [{ accountNumber: "3010", month: 1, amount: 100000 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on empty entries", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "d4f1b2c3-a456-4890-a234-567890abcdef",
          name: "Tom",
          entries: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on zero amount", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "d4f1b2c3-a456-4890-a234-567890abcdef",
          name: "Noll",
          entries: [{ accountNumber: "3010", month: 1, amount: 0 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── PUT /:orgId/budgets/:budgetId ────────────────────────

  describe("PUT /:orgId/budgets/:budgetId", () => {
    it("updates budget name", async () => {
      repos.budgets.update.mockResolvedValue(ok({ ...sampleBudget, name: "Uppdaterad" }));

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/budget-1`,
        payload: { name: "Uppdaterad" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Uppdaterad");
    });

    it("updates budget entries", async () => {
      repos.budgets.update.mockResolvedValue(ok(sampleBudget));

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/budget-1`,
        payload: {
          entries: [
            { accountNumber: "4010", month: 2, amount: 200000 },
            { accountNumber: "5020", month: 2, amount: -100000 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when budget not found", async () => {
      repos.budgets.update.mockResolvedValue(
        err({ code: "NOT_FOUND" as const, message: "Hittades inte" }),
      );

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/missing`,
        payload: { name: "Ny" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 on duplicate name", async () => {
      repos.budgets.update.mockResolvedValue(
        err({ code: "DUPLICATE_NAME" as const, message: "Finns redan" }),
      );

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/budget-1`,
        payload: { name: "Duplicat" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── DELETE /:orgId/budgets/:budgetId ─────────────────────

  describe("DELETE /:orgId/budgets/:budgetId", () => {
    it("deletes budget and returns 204", async () => {
      repos.budgets.delete.mockResolvedValue(true);

      const res = await app.inject({
        method: "DELETE",
        url: `${baseUrl}/budget-1`,
      });

      expect(res.statusCode).toBe(204);
      expect(repos.budgets.delete).toHaveBeenCalledWith("budget-1", orgId);
    });

    it("returns 404 for non-existent budget", async () => {
      repos.budgets.delete.mockResolvedValue(false);

      const res = await app.inject({
        method: "DELETE",
        url: `${baseUrl}/missing`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /:orgId/budgets/:budgetId/vs-actual ──────────────

  describe("GET /:orgId/budgets/:budgetId/vs-actual", () => {
    it("returns budget vs actual report", async () => {
      repos.budgets.findById.mockResolvedValue(sampleBudget);
      repos.vouchers.findByFiscalYear.mockResolvedValue([
        {
          id: "v-1",
          fiscalYearId: "fy-1",
          organizationId: orgId,
          number: 1,
          date: new Date("2024-01-15"),
          description: "Försäljning",
          lines: [
            { id: "vl-1", voucherId: "v-1", accountNumber: "3010", debit: 0, credit: 80000 },
            { id: "vl-2", voucherId: "v-1", accountNumber: "1930", debit: 80000, credit: 0 },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      repos.accounts.findByOrganization.mockResolvedValue([
        { id: "a-1", organizationId: orgId, number: "3010", name: "Försäljning", isActive: true },
        { id: "a-2", organizationId: orgId, number: "5010", name: "Lokalhyra", isActive: true },
        { id: "a-3", organizationId: orgId, number: "1930", name: "Företagskonto", isActive: true },
      ]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/budget-1/vs-actual`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.budgetName).toBe("Budget 2024");
      expect(body.data.rows).toEqual(expect.any(Array));
      expect(body.data.rows.length).toBeGreaterThan(0);
      expect(body.data.generatedAt).toEqual(expect.any(String));
    });

    it("returns 404 when budget not found", async () => {
      repos.budgets.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/missing/vs-actual`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("filters vouchers by date range", async () => {
      repos.budgets.findById.mockResolvedValue(sampleBudget);
      repos.vouchers.findByFiscalYear.mockResolvedValue([
        {
          id: "v-1",
          fiscalYearId: "fy-1",
          organizationId: orgId,
          number: 1,
          date: new Date("2024-01-15"),
          description: "Januari",
          lines: [{ id: "vl-1", voucherId: "v-1", accountNumber: "3010", debit: 0, credit: 50000 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "v-2",
          fiscalYearId: "fy-1",
          organizationId: orgId,
          number: 2,
          date: new Date("2024-03-15"),
          description: "Mars",
          lines: [{ id: "vl-2", voucherId: "v-2", accountNumber: "3010", debit: 0, credit: 30000 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      repos.accounts.findByOrganization.mockResolvedValue([
        { id: "a-1", organizationId: orgId, number: "3010", name: "Försäljning", isActive: true },
      ]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/budget-1/vs-actual?startDate=2024-02-01&endDate=2024-12-31`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Only the March voucher should be included (January is before startDate)
      const row3010 = body.data.rows.find(
        (r: { accountNumber: string }) => r.accountNumber === "3010",
      );
      // actual = 0 - 30000 = -30000 öre = -300 kr
      expect(row3010.actual).toBe(-300);
    });
  });
});
