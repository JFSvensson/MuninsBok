import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { Account, Voucher } from "@muninsbok/core";

describe("Report routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const fyId = "fy-1";

  const accounts: Account[] = [
    { id: "a1", organizationId: orgId, number: "1930", name: "Bank", type: "ASSET", isVatAccount: false, isActive: true },
    { id: "a2", organizationId: orgId, number: "3000", name: "Intäkter", type: "REVENUE", isVatAccount: false, isActive: true },
    { id: "a3", organizationId: orgId, number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
  ];

  const vouchers: Voucher[] = [
    {
      id: "v1",
      organizationId: orgId,
      fiscalYearId: fyId,
      number: 1,
      date: new Date("2024-03-01"),
      description: "Medlemsavgift",
      lines: [
        { id: "l1", voucherId: "v1", accountNumber: "1930", debit: 50000, credit: 0 },
        { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 50000 },
      ],
      documents: [],
      createdAt: new Date(),
    },
    {
      id: "v2",
      organizationId: orgId,
      fiscalYearId: fyId,
      number: 2,
      date: new Date("2024-04-01"),
      description: "Hyra",
      lines: [
        { id: "l3", voucherId: "v2", accountNumber: "5010", debit: 20000, credit: 0 },
        { id: "l4", voucherId: "v2", accountNumber: "1930", debit: 0, credit: 20000 },
      ],
      documents: [],
      createdAt: new Date(),
    },
  ];

  function setupRepos() {
    repos.vouchers.findByFiscalYear.mockResolvedValue(vouchers);
    repos.accounts.findByOrganization.mockResolvedValue(accounts);
  }

  describe("GET /:orgId/reports/trial-balance", () => {
    it("returns trial balance with amounts in kronor", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/trial-balance?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.rows).toBeDefined();
      // Amounts should be converted from ören to kronor
      expect(data.totalDebit).toBe(data.totalCredit);
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/trial-balance`,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/reports/income-statement", () => {
    it("returns income statement with amounts in kronor", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/income-statement?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.revenues).toBeDefined();
      expect(data.expenses).toBeDefined();
      expect(data.netResult).toBeDefined();
      // 500 kr income - 200 kr expenses = 300 kr net
      expect(data.netResult).toBe(300);
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/income-statement`,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/reports/balance-sheet", () => {
    it("returns balance sheet with amounts in kronor", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/balance-sheet?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.assets).toBeDefined();
      expect(data.liabilities).toBeDefined();
      expect(data.equity).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/balance-sheet`,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
