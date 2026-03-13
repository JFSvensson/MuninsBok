import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("CSV Import routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";

  describe("POST /:orgId/import/csv/parse", () => {
    it("returns 400 without csv data", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/parse`,
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns headers and sample rows", async () => {
      const csv =
        "Datum;Text;Belopp\n2024-01-15;Hyra;-5000\n2024-02-01;Lön;-25000\n2024-03-01;Försäljning;10000";
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/parse`,
        payload: { csv },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.headers).toEqual(["Datum", "Text", "Belopp"]);
      expect(body.data.sampleRows).toHaveLength(3);
      expect(body.data.totalRows).toBe(3);
    });
  });

  describe("POST /:orgId/import/csv/preview", () => {
    it("returns 400 without mapping", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/preview`,
        payload: { csv: "A;B;C\n1;2;3" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 with out-of-range column index", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/preview`,
        payload: {
          csv: "A;B\n1;2",
          mapping: { dateColumn: 0, descriptionColumn: 1, amountColumn: 5 },
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("utanför");
    });

    it("returns preview with parsed transactions", async () => {
      const csv = "Datum;Text;Belopp\n2024-01-15;Hyra;-5000,00\n2024-02-01;Intäkt;10000";
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/preview`,
        payload: {
          csv,
          mapping: { dateColumn: 0, descriptionColumn: 1, amountColumn: 2 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.rows).toHaveLength(2);
      expect(body.data.rows[0].date).toBe("2024-01-15");
      expect(body.data.rows[0].amount).toBe(-5000); // kronor
      expect(body.data.rows[1].amount).toBe(10000);
      expect(body.data.errors).toHaveLength(0);
    });
  });

  describe("POST /:orgId/import/csv/execute", () => {
    const accounts = [
      {
        number: "1930",
        name: "Företagskonto",
        type: "ASSET" as const,
        isVatAccount: false,
        isActive: true,
      },
      {
        number: "3000",
        name: "Försäljning",
        type: "REVENUE" as const,
        isVatAccount: false,
        isActive: true,
      },
      {
        number: "5010",
        name: "Hyra",
        type: "EXPENSE" as const,
        isVatAccount: false,
        isActive: true,
      },
    ];

    it("returns 400 without fiscalYearId", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: { bankAccountNumber: "1930", defaultAccountNumber: "3000", transactions: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for non-existent fiscal year", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: {
          fiscalYearId: "fy-1",
          bankAccountNumber: "1930",
          defaultAccountNumber: "3000",
          transactions: [{ date: "2024-01-15", description: "Test", amount: 100 }],
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for closed fiscal year", async () => {
      repos.fiscalYears.findById.mockResolvedValue({
        id: "fy-1",
        organizationId: orgId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        isClosed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repos.accounts.findByOrganization.mockResolvedValue(accounts);
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: {
          fiscalYearId: "fy-1",
          bankAccountNumber: "1930",
          defaultAccountNumber: "3000",
          transactions: [{ date: "2024-01-15", description: "Test", amount: 100 }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("stängt");
    });

    it("returns 400 for non-existent bank account", async () => {
      repos.fiscalYears.findById.mockResolvedValue({
        id: "fy-1",
        organizationId: orgId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repos.accounts.findByOrganization.mockResolvedValue([]);
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: {
          fiscalYearId: "fy-1",
          bankAccountNumber: "9999",
          defaultAccountNumber: "3000",
          transactions: [{ date: "2024-01-15", description: "Test", amount: 100 }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("9999");
    });

    it("creates vouchers for valid transactions", async () => {
      repos.fiscalYears.findById.mockResolvedValue({
        id: "fy-1",
        organizationId: orgId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repos.accounts.findByOrganization.mockResolvedValue(accounts);
      repos.vouchers.create.mockResolvedValue({ ok: true, value: { id: "v1" } });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: {
          fiscalYearId: "fy-1",
          bankAccountNumber: "1930",
          defaultAccountNumber: "3000",
          transactions: [
            { date: "2024-01-15", description: "Försäljning", amount: 500000 },
            { date: "2024-01-16", description: "Hyra", amount: -200000 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.vouchersCreated).toBe(2);
      expect(body.data.errors).toHaveLength(0);

      // Verify voucher creation calls
      expect(repos.vouchers.create).toHaveBeenCalledTimes(2);

      // Positive amount: debit bank, credit contra
      const firstCall = repos.vouchers.create.mock.calls[0]![0];
      expect(firstCall.lines).toEqual([
        { accountNumber: "1930", debit: 500000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 500000 },
      ]);

      // Negative amount: debit contra, credit bank
      const secondCall = repos.vouchers.create.mock.calls[1]![0];
      expect(secondCall.lines).toEqual([
        { accountNumber: "3000", debit: 200000, credit: 0 },
        { accountNumber: "1930", debit: 0, credit: 200000 },
      ]);
    });

    it("reports errors for failed voucher creation", async () => {
      repos.fiscalYears.findById.mockResolvedValue({
        id: "fy-1",
        organizationId: orgId,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repos.accounts.findByOrganization.mockResolvedValue(accounts);
      repos.vouchers.create
        .mockResolvedValueOnce({ ok: true, value: { id: "v1" } })
        .mockResolvedValueOnce({ ok: false, error: { message: "Ogiltigt datum" } });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/import/csv/execute`,
        payload: {
          fiscalYearId: "fy-1",
          bankAccountNumber: "1930",
          defaultAccountNumber: "3000",
          transactions: [
            { date: "2024-01-15", description: "OK", amount: 100 },
            { date: "2024-01-16", description: "Fail", amount: 200 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.vouchersCreated).toBe(1);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0]).toContain("Ogiltigt datum");
    });
  });
});
