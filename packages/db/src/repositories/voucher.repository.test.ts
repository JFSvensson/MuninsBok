import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { VoucherRepository } from "./voucher.repository.js";

describe("VoucherRepository", () => {
  it("locks the fiscal year before reading the next correction voucher number", async () => {
    const callOrder: string[] = [];
    const now = new Date("2026-01-01T00:00:00.000Z");
    const original = {
      id: "v-1",
      organizationId: "org-1",
      fiscalYearId: "fy-1",
      number: 1,
      date: now,
      description: "Original",
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      correctsVoucherId: null,
      correctedByVoucher: null,
      submittedAt: null,
      submittedByUserId: null,
      status: "APPROVED",
      lines: [
        {
          id: "line-1",
          voucherId: "v-1",
          accountId: "account-1",
          accountNumber: "1930",
          debit: 100,
          credit: 0,
          description: null,
        },
      ],
      documents: [],
      approvalSteps: [],
    };
    const correction = {
      ...original,
      id: "v-2",
      number: 2,
      description: "Rättelse av verifikat #1",
      correctsVoucherId: "v-1",
      lines: [
        {
          ...original.lines[0],
          id: "line-2",
          voucherId: "v-2",
          debit: 0,
          credit: 100,
        },
      ],
    };
    const transaction = {
      $queryRaw: vi.fn().mockImplementation(() => {
        callOrder.push("lock");
        return [];
      }),
      $executeRaw: vi.fn(),
      voucher: {
        findFirst: vi.fn().mockImplementation(() => {
          callOrder.push("read-number");
          return { number: 1 };
        }),
        create: vi.fn().mockImplementation(() => {
          callOrder.push("create");
          return correction;
        }),
      },
    };
    const prisma = {
      voucher: { findFirst: vi.fn().mockResolvedValue(original) },
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaClient;

    const result = await new VoucherRepository(prisma).createCorrection("v-1", "org-1");

    expect(result.ok).toBe(true);
    expect(callOrder).toEqual(["lock", "read-number", "create"]);
    expect(transaction.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 2 }) }),
    );
  });

  it("rejects documents that do not belong to the voucher organization", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const transaction = vi.fn();
    const prisma = {
      document: { findMany },
      $transaction: transaction,
    } as unknown as PrismaClient;

    const result = await new VoucherRepository(prisma).create({
      organizationId: "org-1",
      fiscalYearId: "fy-1",
      date: new Date("2026-01-01T00:00:00.000Z"),
      description: "Test voucher",
      lines: [],
      documentIds: ["doc-from-another-organization"],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Ett eller flera dokument hittades inte",
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["doc-from-another-organization"] },
        organizationId: "org-1",
      },
      select: { id: true },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
