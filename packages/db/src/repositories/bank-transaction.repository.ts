import { type Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type {
  IBankTransactionRepository,
  BankTransaction,
  UpsertBankTransactionInput,
  BankTransactionMatchUpdateInput,
  BankTransactionError,
  PaginatedQuery,
  PaginatedResult,
  Result,
} from "@muninsbok/core/types";
import { ok } from "@muninsbok/core/types";
import { toBankTransaction } from "../mappers.js";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class BankTransactionRepository implements IBankTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, organizationId: string): Promise<BankTransaction | null> {
    const row = await this.prisma.bankTransaction.findFirst({
      where: { id, organizationId },
    });
    return row ? toBankTransaction(row) : null;
  }

  async findByConnectionPaginated(
    connectionId: string,
    organizationId: string,
    options: PaginatedQuery & {
      fromDate?: Date;
      toDate?: Date;
      matchStatus?: "PENDING_MATCH" | "MATCHED" | "CONFIRMED" | "ERROR";
    },
  ): Promise<PaginatedResult<BankTransaction>> {
    const { page, limit, search, fromDate, toDate, matchStatus } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.BankTransactionWhereInput = {
      organizationId,
      connectionId,
      ...(matchStatus != null && { matchStatus }),
      ...(search != null &&
        search.trim().length > 0 && {
          description: { contains: search.trim(), mode: "insensitive" },
        }),
      ...((fromDate != null || toDate != null) && {
        bookedAt: {
          ...(fromDate != null && { gte: fromDate }),
          ...(toDate != null && { lte: toDate }),
        },
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.bankTransaction.count({ where }),
      this.prisma.bankTransaction.findMany({
        where,
        orderBy: [{ bookedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toBankTransaction),
      total,
      page,
      limit,
    };
  }

  async findUnmatchedByOrganization(
    organizationId: string,
    limit: number,
  ): Promise<BankTransaction[]> {
    const rows = await this.prisma.bankTransaction.findMany({
      where: {
        organizationId,
        matchStatus: "PENDING_MATCH",
      },
      orderBy: [{ bookedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    return rows.map(toBankTransaction);
  }

  async upsertMany(
    organizationId: string,
    connectionId: string,
    transactions: readonly UpsertBankTransactionInput[],
  ): Promise<Result<{ created: number; updated: number }, BankTransactionError>> {
    if (transactions.length === 0) {
      return ok({ created: 0, updated: 0 });
    }

    const providerIds = [...new Set(transactions.map((tx) => tx.providerTransactionId))];

    const existing = await this.prisma.bankTransaction.findMany({
      where: {
        connectionId,
        providerTransactionId: { in: providerIds },
      },
      select: { providerTransactionId: true },
    });

    const existingIds = new Set(existing.map((row) => row.providerTransactionId));

    const counts = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const item of transactions) {
        const data = {
          bookedAt: item.bookedAt,
          valueDate: item.valueDate ?? null,
          description: item.description,
          amountOre: item.amountOre,
          currency: item.currency ?? "SEK",
          reference: item.reference ?? null,
          counterpartyName: item.counterpartyName ?? null,
          ...(item.rawData !== undefined && { rawData: toJsonValue(item.rawData) }),
        };

        await tx.bankTransaction.upsert({
          where: {
            connectionId_providerTransactionId: {
              connectionId,
              providerTransactionId: item.providerTransactionId,
            },
          },
          create: {
            organizationId,
            connectionId,
            providerTransactionId: item.providerTransactionId,
            ...data,
          },
          update: data,
        });

        if (existingIds.has(item.providerTransactionId)) {
          updated++;
        } else {
          created++;
        }
      }

      return { created, updated };
    });

    return ok(counts);
  }

  async updateMatch(
    id: string,
    organizationId: string,
    input: BankTransactionMatchUpdateInput,
  ): Promise<BankTransaction | null> {
    const existing = await this.prisma.bankTransaction.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await this.prisma.bankTransaction.update({
      where: { id },
      data: {
        matchStatus: input.status,
        ...(input.matchedVoucherId !== undefined && { matchedVoucherId: input.matchedVoucherId }),
        ...(input.matchConfidence !== undefined && { matchConfidence: input.matchConfidence }),
        ...(input.matchNote !== undefined && { matchNote: input.matchNote }),
      },
    });

    return toBankTransaction(updated);
  }

  async deleteByConnection(connectionId: string, organizationId: string): Promise<number> {
    const deleted = await this.prisma.bankTransaction.deleteMany({
      where: {
        connectionId,
        organizationId,
      },
    });
    return deleted.count;
  }
}
