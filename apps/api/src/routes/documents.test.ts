import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Document routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;
  let receiptOcr: { analyze: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
    receiptOcr = ctx.receiptOcr as { analyze: ReturnType<typeof vi.fn> };
  });

  const orgId = "org-1";
  const voucherId = "v-1";
  const sampleDoc = {
    id: "d1",
    organizationId: orgId,
    voucherId: "v-1",
    filename: "kvitto.pdf",
    mimeType: "application/pdf",
    storageKey: "org-1/abc.pdf",
    size: 1024,
    createdAt: new Date(),
  };

  describe("GET /:orgId/vouchers/:voucherId/documents", () => {
    it("returns document list", async () => {
      repos.documents.findByVoucher.mockResolvedValue([sampleDoc]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/vouchers/${voucherId}/documents`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].filename).toBe("kvitto.pdf");
    });

    it("returns empty array when no documents", async () => {
      repos.documents.findByVoucher.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/vouchers/${voucherId}/documents`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });
  });

  describe("GET /:orgId/documents/:documentId/download", () => {
    it("returns 404 when document not found", async () => {
      repos.documents.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/documents/nonexistent/download`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain("hittades inte");
    });

    it("returns file data with correct headers", async () => {
      repos.documents.findById.mockResolvedValue(sampleDoc);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/documents/d1/download`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("kvitto.pdf");
    });
  });

  describe("POST /:orgId/receipt-ocr/analyze", () => {
    it("returns parsed OCR analysis for a temporary upload", async () => {
      const boundary = "----muninsbok-ocr";
      const payload =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="kvitto.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n` +
        `fake-image-data\r\n` +
        `--${boundary}--\r\n`;

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/receipt-ocr/analyze`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(receiptOcr.analyze).toHaveBeenCalledOnce();
      expect(res.json().data.merchantName).toBe("ICA Nara");
    });
  });

  describe("GET /:orgId/receipt-ocr/status", () => {
    it("reports PDF OCR as enabled when feature flag is set", async () => {
      const previous = process.env["OCR_ENABLE_PDF"];
      process.env["OCR_ENABLE_PDF"] = "true";

      try {
        const res = await app.inject({
          method: "GET",
          url: `/api/organizations/${orgId}/receipt-ocr/status`,
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data.pdfEnabled).toBe(true);
        expect(body.data.supportedMimeTypes).toContain("application/pdf");
      } finally {
        if (previous === undefined) delete process.env["OCR_ENABLE_PDF"];
        else process.env["OCR_ENABLE_PDF"] = previous;
      }
    });
  });

  describe("POST /:orgId/documents/:documentId/receipt-ocr", () => {
    it("returns 404 when the stored document does not exist", async () => {
      repos.documents.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/documents/nonexistent/receipt-ocr`,
      });

      expect(res.statusCode).toBe(404);
      expect(receiptOcr.analyze).not.toHaveBeenCalled();
    });

    it("analyzes an already uploaded document", async () => {
      repos.documents.findById.mockResolvedValue({
        ...sampleDoc,
        filename: "kvitto.jpg",
        mimeType: "image/jpeg",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/documents/d1/receipt-ocr`,
      });

      expect(res.statusCode).toBe(200);
      expect(receiptOcr.analyze).toHaveBeenCalledOnce();
      expect(res.json().data.totalAmountOre).toBe(12345);
    });
  });

  describe("DELETE /:orgId/documents/:documentId", () => {
    it("returns 404 when document not found", async () => {
      repos.documents.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/documents/nonexistent`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain("hittades inte");
    });

    it("returns 403 when deleting document in closed fiscal year", async () => {
      repos.documents.findById.mockResolvedValue(sampleDoc);
      repos.vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(true);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/documents/d1`,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("FISCAL_YEAR_CLOSED");
    });

    it("returns 204 on successful delete", async () => {
      repos.documents.findById.mockResolvedValue(sampleDoc);
      repos.vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(false);
      repos.documents.delete.mockResolvedValue(undefined);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/documents/d1`,
      });

      expect(res.statusCode).toBe(204);
    });
  });

  describe("POST /:orgId/vouchers/:voucherId/documents (upload)", () => {
    it("returns 400 when no file is attached", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/${voucherId}/documents`,
        headers: {
          "content-type": "multipart/form-data; boundary=----testboundary",
        },
        payload: "------testboundary--\r\n",
      });

      // Should return 400 — no file
      expect(res.statusCode).toBe(400);
    });
  });
});
