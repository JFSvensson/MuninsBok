import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Voucher routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseUrl = `/api/organizations/${orgId}/vouchers`;

  const sampleVoucher = {
    id: "v-1",
    organizationId: orgId,
    fiscalYearId: "fy-1",
    number: 1,
    date: new Date("2024-01-15"),
    description: "Banköverföring",
    lines: [
      { id: "l1", voucherId: "v-1", accountNumber: "1930", debit: 10000, credit: 0 },
      { id: "l2", voucherId: "v-1", accountNumber: "1910", debit: 0, credit: 10000 },
    ],
    documents: [],
  };

  describe("GET /:orgId/vouchers", () => {
    it("returns vouchers by fiscal year", async () => {
      repos.vouchers.findByFiscalYearPaginated.mockResolvedValue({
        vouchers: [sampleVoucher],
        total: 1,
        page: 1,
        limit: 50,
      });

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}?fiscalYearId=fy-1`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(1);
      expect(repos.vouchers.findByFiscalYearPaginated).toHaveBeenCalled();
    });

    it("returns vouchers by date range", async () => {
      repos.vouchers.findByDateRange.mockResolvedValue([sampleVoucher]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}?startDate=2024-01-01&endDate=2024-12-31`,
      });

      expect(res.statusCode).toBe(200);
      expect(repos.vouchers.findByDateRange).toHaveBeenCalledWith(
        orgId,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it("returns 400 if no filter provided", async () => {
      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/vouchers/:voucherId", () => {
    it("returns voucher by id", async () => {
      repos.vouchers.findById.mockResolvedValue(sampleVoucher);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/v-1` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.description).toBe("Banköverföring");
    });

    it("returns 404 for unknown voucher", async () => {
      repos.vouchers.findById.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/unknown` });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /:orgId/vouchers", () => {
    it("creates voucher with valid data", async () => {
      repos.vouchers.create.mockResolvedValue({ ok: true, value: sampleVoucher });

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "fy-1",
          date: "2024-01-15",
          description: "Banköverföring",
          lines: [
            { accountNumber: "1930", debit: 10000, credit: 0 },
            { accountNumber: "1910", debit: 0, credit: 10000 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(repos.vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          fiscalYearId: "fy-1",
        }),
      );
    });

    it("returns 400 for invalid voucher lines", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "fy-1",
          date: "2024-01-15",
          description: "Test",
          lines: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for missing description", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "fy-1",
          date: "2024-01-15",
          description: "",
          lines: [{ accountNumber: "1930", debit: 1000, credit: 0 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when repo create fails", async () => {
      repos.vouchers.create.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Räkenskapsåret hittades inte" },
      });

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: {
          fiscalYearId: "fy-1",
          date: "2024-01-15",
          description: "Test",
          lines: [{ accountNumber: "1930", debit: 1000, credit: 0 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /:orgId/vouchers/:voucherId/correct", () => {
    it("creates correction voucher", async () => {
      const correctionVoucher = {
        ...sampleVoucher,
        id: "v-2",
        number: 2,
        description: "Rättelse av verifikat #1",
        correctsVoucherId: "v-1",
        lines: [
          { id: "l3", voucherId: "v-2", accountNumber: "1930", debit: 0, credit: 10000 },
          { id: "l4", voucherId: "v-2", accountNumber: "1910", debit: 10000, credit: 0 },
        ],
      };
      repos.vouchers.createCorrection.mockResolvedValue({ ok: true, value: correctionVoucher });

      const res = await app.inject({ method: "POST", url: `${baseUrl}/v-1/correct` });

      expect(res.statusCode).toBe(201);
      expect(repos.vouchers.createCorrection).toHaveBeenCalledWith("v-1", orgId);
    });

    it("returns 404 for unknown voucher", async () => {
      repos.vouchers.createCorrection.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Verifikatet hittades inte" },
      });

      const res = await app.inject({ method: "POST", url: `${baseUrl}/unknown/correct` });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 if already corrected", async () => {
      repos.vouchers.createCorrection.mockResolvedValue({
        ok: false,
        error: { code: "ALREADY_CORRECTED", message: "Verifikatet har redan rättats" },
      });

      const res = await app.inject({ method: "POST", url: `${baseUrl}/v-1/correct` });

      expect(res.statusCode).toBe(400);
    });
  });
});
