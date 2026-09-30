import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { DocumentRepository } from "./document.repository.js";

describe("DocumentRepository", () => {
  it("rejects attaching a document to a voucher in another organization", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const prisma = {
      voucher: { findFirst },
      document: { create },
    } as unknown as PrismaClient;

    const result = await new DocumentRepository(prisma).create({
      organizationId: "org-1",
      voucherId: "voucher-from-another-organization",
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      storageKey: "org-1/receipt.pdf",
      size: 128,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Verifikatet hittades inte",
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "voucher-from-another-organization",
        organizationId: "org-1",
      },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
