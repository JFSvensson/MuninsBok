import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

// Mock DocumentStorage so tests never touch the file system
vi.mock("../services/document-storage.js", () => {
  return {
    DocumentStorage: vi.fn().mockImplementation(() => ({
      generateStorageKey: vi.fn().mockReturnValue("org-1/uuid.pdf"),
      store: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(Buffer.from("fake-file-data")),
      remove: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("Document routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
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

      // Mock the prisma chain: voucher found → fiscal year is closed
      repos.prisma.voucher = {
        findFirst: vi.fn().mockResolvedValue({ fiscalYearId: "fy-1" }),
      };
      repos.prisma.fiscalYear = {
        findFirst: vi.fn().mockResolvedValue({ isClosed: true }),
      };

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/documents/d1`,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("FISCAL_YEAR_CLOSED");
    });

    it("returns 204 on successful delete", async () => {
      repos.documents.findById.mockResolvedValue(sampleDoc);

      // Voucher exists but fiscal year is NOT closed
      repos.prisma.voucher = {
        findFirst: vi.fn().mockResolvedValue({ fiscalYearId: "fy-1" }),
      };
      repos.prisma.fiscalYear = {
        findFirst: vi.fn().mockResolvedValue({ isClosed: false }),
      };
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
