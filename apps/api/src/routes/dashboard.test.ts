import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { Account, Voucher } from "@muninsbok/core/types";

describe("Dashboard routes", () => {
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
      status: "DRAFT",
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
      status: "DRAFT",
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
    repos.fiscalYears.findById.mockResolvedValue(null);
  }

  it("returns 400 without fiscalYearId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("fiscalYearId");
  });

  it("returns dashboard summary with all fields", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const d = body.data;

    expect(d.voucherCount).toBe(2);
    expect(d.accountCount).toBe(3);
    expect(d.isBalanced).toBe(true);
    expect(d.totalDebit).toBe(d.totalCredit);
    expect(d.generatedAt).toBeTruthy();
  });

  it("returns net result from income statement", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    // Revenue 500 - Expenses 200 = 300 kr net result
    expect(d.netResult).toBe(300);
  });

  it("returns latest vouchers sorted by number descending", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.latestVouchers).toHaveLength(2);
    expect(d.latestVouchers[0].number).toBe(2);
    expect(d.latestVouchers[1].number).toBe(1);
  });

  it("returns account type counts", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.accountTypeCounts).toEqual({
      ASSET: 1,
      REVENUE: 1,
      EXPENSE: 1,
    });
  });

  it("returns monthly trend data", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.monthlyTrend).toHaveLength(2);
    // March: revenue 500 kr, expense 0
    expect(d.monthlyTrend[0].month).toBe("2024-03");
    expect(d.monthlyTrend[0].income).toBe(500);
    expect(d.monthlyTrend[0].expense).toBe(0);
    expect(d.monthlyTrend[0].voucherCount).toBe(1);
    // April: revenue 0, expense 200 kr
    expect(d.monthlyTrend[1].month).toBe("2024-04");
    expect(d.monthlyTrend[1].income).toBe(0);
    expect(d.monthlyTrend[1].expense).toBe(200);
  });

  it("handles empty data gracefully", async () => {
    repos.vouchers.findByFiscalYear.mockResolvedValue([]);
    repos.accounts.findByOrganization.mockResolvedValue([]);
    repos.fiscalYears.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.voucherCount).toBe(0);
    expect(d.accountCount).toBe(0);
    expect(d.netResult).toBe(0);
    expect(d.isBalanced).toBe(true);
    expect(d.latestVouchers).toHaveLength(0);
    expect(d.monthlyTrend).toHaveLength(0);
    expect(d.yearComparison).toHaveLength(0);
    expect(d.previousYearResult).toBeNull();
    expect(d.forecast).toBeNull();
  });

  it("returns enhanced fields (yearComparison, forecast)", async () => {
    const fy = {
      id: fyId,
      organizationId: orgId,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      isClosed: false,
    };
    const prevFyId = "fy-prev";
    const prevFy = {
      id: prevFyId,
      organizationId: orgId,
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      isClosed: true,
    };

    // 3 months of data for forecast
    const extendedVouchers: Voucher[] = [
      ...vouchers,
      {
        id: "v3",
        organizationId: orgId,
        fiscalYearId: fyId,
        number: 3,
        date: new Date("2024-05-01"),
        description: "Maj intäkt",
        status: "DRAFT",
        lines: [
          { id: "l5", voucherId: "v3", accountNumber: "1930", debit: 30000, credit: 0 },
          { id: "l6", voucherId: "v3", accountNumber: "3000", debit: 0, credit: 30000 },
        ],
        documentIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const prevVouchers: Voucher[] = [
      {
        id: "pv1",
        organizationId: orgId,
        fiscalYearId: prevFyId,
        number: 1,
        date: new Date("2023-03-15"),
        description: "Förra årets intäkt",
        status: "DRAFT",
        lines: [
          { id: "pl1", voucherId: "pv1", accountNumber: "1930", debit: 40000, credit: 0 },
          { id: "pl2", voucherId: "pv1", accountNumber: "3000", debit: 0, credit: 40000 },
        ],
        documentIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    repos.accounts.findByOrganization.mockResolvedValue(accounts);
    repos.fiscalYears.findById.mockResolvedValue(fy);
    repos.fiscalYears.findPreviousByDate.mockResolvedValue(prevFy);

    // First call: current year vouchers, second call: previous year vouchers
    repos.vouchers.findByFiscalYear
      .mockResolvedValueOnce(extendedVouchers)
      .mockResolvedValueOnce(prevVouchers);

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    expect(res.statusCode).toBe(200);
    const d = res.json().data;

    // Year comparison should include months from both years
    expect(d.yearComparison.length).toBeGreaterThan(0);
    // Previous year had revenue in March
    const marchComp = d.yearComparison.find((m: { month: string }) => m.month === "03");
    expect(marchComp).toBeDefined();
    expect(marchComp.previousIncome).toBe(400); // 40000 öre = 400 kr

    // Previous year result
    expect(d.previousYearResult).toBe(400); // 400 kr net (only revenue)

    // Forecast should exist (3+ months of data)
    expect(d.forecast).not.toBeNull();
    expect(d.forecast.dataPoints).toBe(3);
    expect(typeof d.forecast.projectedIncome).toBe("number");
    expect(typeof d.forecast.projectedExpense).toBe("number");
    expect(typeof d.forecast.projectedYearEndResult).toBe("number");
  });

  it("returns null forecast with less than 2 months of data", async () => {
    const fy = {
      id: fyId,
      organizationId: orgId,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      isClosed: false,
    };

    // Only 1 voucher (1 month of data)
    const singleVoucher = [vouchers[0]];
    repos.vouchers.findByFiscalYear.mockResolvedValue(singleVoucher);
    repos.accounts.findByOrganization.mockResolvedValue(accounts);
    repos.fiscalYears.findById.mockResolvedValue(fy);
    repos.fiscalYears.findPreviousByDate.mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/dashboard?fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.forecast).toBeNull();
    expect(d.yearComparison).toHaveLength(0);
    expect(d.previousYearResult).toBeNull();
  });
});
