import { type PrismaClient } from "../generated/prisma/client.js";
import type {
  IBankSyncRunRepository,
  BankSyncRun,
  CreateBankSyncRunInput,
  CompleteBankSyncRunInput,
} from "@muninsbok/core/types";
import { toBankSyncRun } from "../mappers.js";

export class BankSyncRunRepository implements IBankSyncRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, organizationId: string): Promise<BankSyncRun | null> {
    const row = await this.prisma.bankSyncRun.findFirst({
      where: { id, organizationId },
    });
    return row ? toBankSyncRun(row) : null;
  }

  async findLatestByConnection(
    connectionId: string,
    organizationId: string,
    limit: number,
  ): Promise<BankSyncRun[]> {
    const rows = await this.prisma.bankSyncRun.findMany({
      where: { connectionId, organizationId },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return rows.map(toBankSyncRun);
  }

  async create(
    organizationId: string,
    connectionId: string,
    input: CreateBankSyncRunInput,
  ): Promise<BankSyncRun> {
    const row = await this.prisma.bankSyncRun.create({
      data: {
        organizationId,
        connectionId,
        trigger: input.trigger,
        status: input.status ?? "PENDING",
        externalRunId: input.externalRunId ?? null,
        startedAt: input.startedAt ?? new Date(),
      },
    });

    return toBankSyncRun(row);
  }

  async markRunning(id: string, organizationId: string): Promise<BankSyncRun | null> {
    const existing = await this.prisma.bankSyncRun.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await this.prisma.bankSyncRun.update({
      where: { id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    return toBankSyncRun(updated);
  }

  async complete(
    id: string,
    organizationId: string,
    input: CompleteBankSyncRunInput,
  ): Promise<BankSyncRun | null> {
    const existing = await this.prisma.bankSyncRun.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await this.prisma.bankSyncRun.update({
      where: { id },
      data: {
        status: input.status,
        completedAt: input.completedAt ?? new Date(),
        ...(input.importedCount !== undefined && { importedCount: input.importedCount }),
        ...(input.updatedCount !== undefined && { updatedCount: input.updatedCount }),
        ...(input.failedCount !== undefined && { failedCount: input.failedCount }),
        ...(input.errorCode !== undefined && { errorCode: input.errorCode }),
        ...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
      },
    });

    return toBankSyncRun(updated);
  }
}
