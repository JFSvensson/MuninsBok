import { type Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type {
  IBankConnectionRepository,
  BankConnection,
  CreateBankConnectionInput,
  UpdateBankConnectionInput,
  UpdateBankConnectionStatusInput,
  BankConnectionError,
  Result,
} from "@muninsbok/core/types";
import { ok } from "@muninsbok/core/types";
import { toBankConnection } from "../mappers.js";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class BankConnectionRepository implements IBankConnectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<BankConnection[]> {
    const rows = await this.prisma.bankConnection.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }],
    });
    return rows.map(toBankConnection);
  }

  async findById(id: string, organizationId: string): Promise<BankConnection | null> {
    const row = await this.prisma.bankConnection.findFirst({
      where: { id, organizationId },
    });
    return row ? toBankConnection(row) : null;
  }

  async findByExternalConnectionId(
    organizationId: string,
    provider: string,
    externalConnectionId: string,
  ): Promise<BankConnection | null> {
    const row = await this.prisma.bankConnection.findFirst({
      where: { organizationId, provider, externalConnectionId },
    });
    return row ? toBankConnection(row) : null;
  }

  async create(
    organizationId: string,
    input: CreateBankConnectionInput,
  ): Promise<Result<BankConnection, BankConnectionError>> {
    const created = await this.prisma.bankConnection.create({
      data: {
        organizationId,
        provider: input.provider,
        externalConnectionId: input.externalConnectionId,
        displayName: input.displayName ?? null,
        accountName: input.accountName ?? null,
        accountIban: input.accountIban ?? null,
        accountLast4: input.accountLast4 ?? null,
        currency: input.currency ?? "SEK",
        status: input.status ?? "AUTH_REQUIRED",
        authExpiresAt: input.authExpiresAt ?? null,
        ...(input.metadata !== undefined && { metadata: toJsonValue(input.metadata) }),
      },
    });

    return ok(toBankConnection(created));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateBankConnectionInput,
  ): Promise<Result<BankConnection, BankConnectionError>> {
    const existing = await this.prisma.bankConnection.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Bankanslutningen hittades inte",
        },
      };
    }

    const updated = await this.prisma.bankConnection.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.accountName !== undefined && { accountName: input.accountName }),
        ...(input.accountIban !== undefined && { accountIban: input.accountIban }),
        ...(input.accountLast4 !== undefined && { accountLast4: input.accountLast4 }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.authExpiresAt !== undefined && { authExpiresAt: input.authExpiresAt }),
        ...(input.lastSyncedAt !== undefined && { lastSyncedAt: input.lastSyncedAt }),
        ...(input.lastErrorCode !== undefined && { lastErrorCode: input.lastErrorCode }),
        ...(input.lastErrorMessage !== undefined && {
          lastErrorMessage: input.lastErrorMessage,
        }),
        ...(input.metadata !== undefined && { metadata: toJsonValue(input.metadata) }),
      },
    });

    return ok(toBankConnection(updated));
  }

  async updateStatus(
    id: string,
    organizationId: string,
    input: UpdateBankConnectionStatusInput,
  ): Promise<BankConnection | null> {
    const existing = await this.prisma.bankConnection.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) return null;

    const updated = await this.prisma.bankConnection.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.authExpiresAt !== undefined && { authExpiresAt: input.authExpiresAt }),
        ...(input.lastSyncedAt !== undefined && { lastSyncedAt: input.lastSyncedAt }),
        ...(input.lastErrorCode !== undefined && { lastErrorCode: input.lastErrorCode }),
        ...(input.lastErrorMessage !== undefined && {
          lastErrorMessage: input.lastErrorMessage,
        }),
      },
    });

    return toBankConnection(updated);
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.prisma.bankConnection.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return false;

    await this.prisma.bankConnection.delete({ where: { id } });
    return true;
  }
}
