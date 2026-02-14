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
    { number: "1930", name: "Bank", type: "ASSET", isVatAccount: false, isActive: true },
    { number: "3000", name: "Intäkter", type: "REVENUE", isVatAccount: false, isActive: true },
    { number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
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
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

  describe("GET /:orgId/reports/journal (Grundbok)", () => {
    it("returns journal with entries sorted by date", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/journal?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.entries).toBeDefined();
      expect(data.entries).toHaveLength(2);
      // v1 is March, v2 is April → already in order
      expect(data.entries[0].voucherNumber).toBe(1);
      expect(data.entries[1].voucherNumber).toBe(2);
      // Amounts in kronor
      expect(data.totalDebit).toBe(data.totalCredit);
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/journal`,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/reports/general-ledger (Huvudbok)", () => {
    it("returns general ledger grouped by account", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/general-ledger?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.accounts).toBeDefined();
      // 3 accounts with transactions: 1930, 3000, 5010
      expect(data.accounts).toHaveLength(3);
      // Sorted by account number
      expect(data.accounts[0].accountNumber).toBe("1930");
      // Running balance
      const bank = data.accounts[0];
      expect(bank.transactions).toHaveLength(2);
      expect(bank.closingBalance).toBe(300); // (500 - 200) kr
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/general-ledger`,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/reports/voucher-list (Verifikationslista)", () => {
    it("returns voucher list sorted by number", async () => {
      setupRepos();

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/voucher-list?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body).data;
      expect(data.entries).toBeDefined();
      expect(data.count).toBe(2);
      expect(data.entries[0].voucherNumber).toBe(1);
      expect(data.entries[1].voucherNumber).toBe(2);
      expect(data.totalDebit).toBe(data.totalCredit);
    });

    it("returns 400 when fiscalYearId missing", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/reports/voucher-list`,
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
