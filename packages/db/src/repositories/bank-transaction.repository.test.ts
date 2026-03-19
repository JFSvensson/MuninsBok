import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { BankTransactionRepository } from "./bank-transaction.repository.js";

function createRepoWithMocks() {
  const findFirst = vi.fn();
  const count = vi.fn();
  const findMany = vi.fn();
  const update = vi.fn();
  const deleteMany = vi.fn();
  const upsert = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    bankTransaction: {
      findFirst,
      count,
      findMany,
      update,
      deleteMany,
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }

      const fn = arg as (tx: { bankTransaction: { upsert: typeof upsert } }) => Promise<unknown>;
      return fn({ bankTransaction: { upsert } });
    }),
  } as unknown as PrismaClient;

  return {
    repo: new BankTransactionRepository(prisma),
    mocks: { findFirst, count, findMany, update, deleteMany, upsert },
  };
}

describe("BankTransactionRepository", () => {
  it("upsertMany reports created/updated idempotently", async () => {
    const { repo, mocks } = createRepoWithMocks();

    mocks.findMany.mockResolvedValue([{ providerTransactionId: "tx-existing" }]);

    const result = await repo.upsertMany("org-1", "conn-1", [
      {
        providerTransactionId: "tx-existing",
        bookedAt: new Date("2026-01-01T00:00:00.000Z"),
        description: "Existing tx",
        amountOre: -1500,
      },
      {
        providerTransactionId: "tx-new",
        bookedAt: new Date("2026-01-02T00:00:00.000Z"),
        description: "New tx",
        amountOre: 5000,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual({ created: 1, updated: 1 });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns paginated transactions", async () => {
    const { repo, mocks } = createRepoWithMocks();

    const now = new Date("2026-01-03T00:00:00.000Z");
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      {
        id: "bt-1",
        organizationId: "org-1",
        connectionId: "conn-1",
        providerTransactionId: "pt-1",
        bookedAt: now,
        valueDate: null,
        description: "Kortköp",
        amountOre: -12345,
        currency: "SEK",
        reference: null,
        counterpartyName: "ICA",
        matchStatus: "PENDING_MATCH",
        matchedVoucherId: null,
        matchConfidence: null,
        matchNote: null,
        rawData: { source: "test" },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const page = await repo.findByConnectionPaginated("conn-1", "org-1", {
      page: 1,
      limit: 20,
    });

    expect(page.total).toBe(1);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.providerTransactionId).toBe("pt-1");
  });

  it("updateMatch returns null when transaction is missing", async () => {
    const { repo, mocks } = createRepoWithMocks();
    mocks.findFirst.mockResolvedValue(null);

    const updated = await repo.updateMatch("missing", "org-1", {
      status: "MATCHED",
      matchedVoucherId: "v-1",
      matchConfidence: 90,
    });

    expect(updated).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deleteByConnection returns deleted row count", async () => {
    const { repo, mocks } = createRepoWithMocks();
    mocks.deleteMany.mockResolvedValue({ count: 3 });

    const deleted = await repo.deleteByConnection("conn-1", "org-1");

    expect(deleted).toBe(3);
  });
});
