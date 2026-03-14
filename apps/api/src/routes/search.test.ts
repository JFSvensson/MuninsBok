import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { Account, Voucher } from "@muninsbok/core/types";

describe("Search routes", () => {
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
    { number: "1930", name: "Företagskonto", type: "ASSET", isVatAccount: false, isActive: true },
    { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
    { number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
    { number: "3010", name: "Bidrag", type: "REVENUE", isVatAccount: false, isActive: true },
  ];

  const vouchers: Voucher[] = [
    {
      id: "v1",
      organizationId: orgId,
      fiscalYearId: fyId,
      number: 1,
      date: new Date("2024-03-01"),
      description: "Medlemsavgift från Johan",
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
      description: "Hyra kontor",
      status: "DRAFT",
      lines: [
        { id: "l3", voucherId: "v2", accountNumber: "5010", debit: 20000, credit: 0 },
        { id: "l4", voucherId: "v2", accountNumber: "1930", debit: 0, credit: 20000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "v3",
      organizationId: orgId,
      fiscalYearId: fyId,
      number: 3,
      date: new Date("2024-05-15"),
      description: "Försäljning av varor",
      status: "DRAFT",
      lines: [
        { id: "l5", voucherId: "v3", accountNumber: "1930", debit: 75000, credit: 0 },
        { id: "l6", voucherId: "v3", accountNumber: "3000", debit: 0, credit: 75000 },
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

  it("returns 400 without query parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?fiscalYearId=${fyId}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("q");
  });

  it("returns 400 with empty query", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=&fiscalYearId=${fyId}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 without fiscalYearId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=test`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("fiscalYearId");
  });

  it("searches vouchers by description", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=hyra&fiscalYearId=${fyId}`,
    });

    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    expect(d.query).toBe("hyra");
    expect(d.vouchers).toHaveLength(1);
    expect(d.vouchers[0].description).toBe("Hyra kontor");
  });

  it("searches vouchers by number", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=2&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.vouchers.some((v: { number: number }) => v.number === 2)).toBe(true);
  });

  it("searches accounts by name", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=försälj&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.accounts).toHaveLength(1);
    expect(d.accounts[0].name).toBe("Försäljning");
  });

  it("searches accounts by number prefix", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=30&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    // Accounts starting with "30": 3000 and 3010
    expect(d.accounts).toHaveLength(2);
  });

  it("returns combined results with totalHits", async () => {
    setupRepos();

    // "Försäljning" matches voucher v3 description AND account 3000
    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=försäljning&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.vouchers.length).toBeGreaterThanOrEqual(1);
    expect(d.accounts.length).toBeGreaterThanOrEqual(1);
    expect(d.totalHits).toBe(d.vouchers.length + d.accounts.length);
  });

  it("returns empty results for non-matching query", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=xyznonexistent&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.vouchers).toHaveLength(0);
    expect(d.accounts).toHaveLength(0);
    expect(d.totalHits).toBe(0);
  });

  it("is case-insensitive for voucher descriptions", async () => {
    setupRepos();

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=HYRA&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.vouchers).toHaveLength(1);
  });

  it("limits results to max 20 per category", async () => {
    // Create 25 vouchers matching "test"
    const manyVouchers = Array.from({ length: 25 }, (_, i) => ({
      id: `v${i}`,
      organizationId: orgId,
      fiscalYearId: fyId,
      number: i + 1,
      date: new Date("2024-01-01"),
      description: `Test verifikat ${i}`,
      status: "DRAFT" as const,
      lines: [
        { id: `l${i}a`, voucherId: `v${i}`, accountNumber: "1930", debit: 10000, credit: 0 },
        { id: `l${i}b`, voucherId: `v${i}`, accountNumber: "3000", debit: 0, credit: 10000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    repos.vouchers.findByFiscalYear.mockResolvedValue(manyVouchers);
    repos.accounts.findByOrganization.mockResolvedValue([]);

    const res = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/search?q=test&fiscalYearId=${fyId}`,
    });

    const d = res.json().data;
    expect(d.vouchers).toHaveLength(20);
  });
});
