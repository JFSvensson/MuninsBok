import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

// Mock core SIE functions
vi.mock("@muninsbok/core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    parseSie: vi.fn(),
    exportSie: vi.fn().mockReturnValue("#FLAGGA 0\n#FORMAT PC8\n"),
  };
});

import { parseSie } from "@muninsbok/core";
const mockParseSie = parseSie as unknown as ReturnType<typeof vi.fn>;

// Mock toFiscalYear from db (called by sie route)
vi.mock("@muninsbok/db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    toFiscalYear: vi.fn((fy: any) => fy),
  };
});

describe("SIE routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  const orgId = "org-1";
  const fyId = "fy-2024";

  const org = { id: orgId, name: "Testbolaget AB", orgNumber: "5591234567" };
  const fiscalYear = {
    id: fyId,
    organizationId: orgId,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  describe("GET /:orgId/sie/export", () => {
    it("returns 400 without fiscalYearId", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/sie/export`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("fiscalYearId krävs");
    });

    it("returns 404 when organization not found", async () => {
      repos.prisma.organization.findUnique.mockResolvedValue(null);
      repos.prisma.fiscalYear.findFirst.mockResolvedValue(fiscalYear);
      repos.accounts.findByOrganization.mockResolvedValue([]);
      repos.vouchers.findByFiscalYear.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/sie/export?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain("Organisationen");
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.prisma.organization.findUnique.mockResolvedValue(org);
      repos.prisma.fiscalYear.findFirst.mockResolvedValue(null);
      repos.accounts.findByOrganization.mockResolvedValue([]);
      repos.vouchers.findByFiscalYear.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/sie/export?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain("Räkenskapsåret");
    });

    it("exports SIE file with correct headers", async () => {
      repos.prisma.organization.findUnique.mockResolvedValue(org);
      repos.prisma.fiscalYear.findFirst
        .mockResolvedValueOnce(fiscalYear) // main FY
        .mockResolvedValueOnce(null); // no previous FY
      repos.accounts.findByOrganization.mockResolvedValue([
        { number: "1930", name: "Bank", type: "asset", isActive: true },
      ]);
      repos.vouchers.findByFiscalYear.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/sie/export?fiscalYearId=${fyId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.headers["content-disposition"]).toContain(".se");
    });
  });

  describe("POST /:orgId/sie/import", () => {
    it("returns 400 without fiscalYearId", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/sie/import`,
        payload: "#FLAGGA 0",
        headers: { "content-type": "text/plain" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("fiscalYearId krävs");
    });

    it("returns 400 when parse fails", async () => {
      mockParseSie.mockReturnValue({
        ok: false,
        error: { code: "INVALID_FORMAT", message: "Ogiltigt SIE-format" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/sie/import?fiscalYearId=${fyId}`,
        payload: "invalid content",
        headers: { "content-type": "text/plain" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("parse");
    });

    it("imports new accounts and vouchers successfully", async () => {
      mockParseSie.mockReturnValue({
        ok: true,
        value: {
          companyName: "Testbolaget AB",
          accounts: [
            { number: "1930", name: "Bank" },
            { number: "3010", name: "Försäljning" },
          ],
          vouchers: [
            {
              series: "A",
              number: 1,
              date: new Date("2024-03-15"),
              description: "Försäljning",
              transactions: [
                { accountNumber: "1930", amount: 10000 },
                { accountNumber: "3010", amount: -10000 },
              ],
            },
          ],
        },
      });

      // Only account 1930 exists already
      repos.accounts.findByOrganization.mockResolvedValue([
        { number: "1930", name: "Bank", type: "asset", isActive: true },
      ]);
      repos.accounts.createMany.mockResolvedValue(undefined);
      repos.vouchers.create.mockResolvedValue({
        ok: true,
        value: { id: "v-new" },
      });

      // Mock $transaction to execute the callback directly
      repos.prisma.$transaction = vi.fn(async (cb: (tx: any) => Promise<void>) => {
        await cb(repos.prisma);
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/sie/import?fiscalYearId=${fyId}`,
        payload: "#FLAGGA 0\n#SIETYP 4",
        headers: { "content-type": "text/plain" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.companyName).toBe("Testbolaget AB");
      expect(body.data.accountsImported).toBe(1); // Only 3010 is new
      expect(body.data.vouchersImported).toBe(1);

      // Verify createMany was called for the new account
      expect(repos.accounts.createMany).toHaveBeenCalledWith(orgId, [
        expect.objectContaining({ number: "3010" }),
      ]);
    });

    it("rolls back all vouchers on error", async () => {
      mockParseSie.mockReturnValue({
        ok: true,
        value: {
          companyName: "Test",
          accounts: [],
          vouchers: [
            {
              series: "A",
              number: 1,
              date: new Date("2024-01-15"),
              description: "OK",
              transactions: [
                { accountNumber: "1930", amount: 100 },
                { accountNumber: "3010", amount: -100 },
              ],
            },
            {
              series: "A",
              number: 2,
              date: new Date("2024-01-16"),
              description: "Fail",
              transactions: [
                { accountNumber: "1930", amount: 200 },
                { accountNumber: "3010", amount: -200 },
              ],
            },
          ],
        },
      });

      repos.accounts.findByOrganization.mockResolvedValue([
        { number: "1930", name: "Bank", type: "asset", isActive: true },
        { number: "3010", name: "Försäljning", type: "income", isActive: true },
      ]);

      // First voucher OK, second fails
      repos.vouchers.create
        .mockResolvedValueOnce({ ok: true, value: { id: "v1" } })
        .mockResolvedValueOnce({
          ok: false,
          error: { message: "Obalanserat verifikat" },
        });

      repos.prisma.$transaction = vi.fn(async (cb: (tx: any) => Promise<void>) => {
        await cb(repos.prisma);
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/sie/import?fiscalYearId=${fyId}`,
        payload: "#FLAGGA 0",
        headers: { "content-type": "text/plain" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Import avbruten");
      expect(res.json().details).toHaveLength(1);
      expect(res.json().details[0]).toContain("A2");
    });
  });
});
