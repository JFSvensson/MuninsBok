import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type {
  IBankWebhookEventRepository,
  BankWebhookEvent,
  CreateBankWebhookEventInput,
  UpdateBankWebhookEventInput,
  BankWebhookEventError,
  Result,
} from "@muninsbok/core/types";
import { ok, err } from "@muninsbok/core/types";
import { toBankWebhookEvent } from "../mappers.js";

export class BankWebhookEventRepository implements IBankWebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, organizationId: string): Promise<BankWebhookEvent | null> {
    const row = await this.prisma.bankWebhookEvent.findFirst({
      where: { id, organizationId },
    });
    return row ? toBankWebhookEvent(row) : null;
  }

  async findByProviderEventId(
    organizationId: string,
    provider: string,
    providerEventId: string,
  ): Promise<BankWebhookEvent | null> {
    const row = await this.prisma.bankWebhookEvent.findFirst({
      where: { organizationId, provider, providerEventId },
    });
    return row ? toBankWebhookEvent(row) : null;
  }

  async listRecentByOrganization(
    organizationId: string,
    limit: number,
  ): Promise<BankWebhookEvent[]> {
    const rows = await this.prisma.bankWebhookEvent.findMany({
      where: { organizationId },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return rows.map(toBankWebhookEvent);
  }

  async create(
    input: CreateBankWebhookEventInput,
  ): Promise<Result<BankWebhookEvent, BankWebhookEventError>> {
    try {
      const row = await this.prisma.bankWebhookEvent.create({
        data: {
          organizationId: input.organizationId,
          connectionId: input.connectionId ?? null,
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          status: input.status ?? "RECEIVED",
          signatureValidated: input.signatureValidated ?? false,
          payload: input.payload as Prisma.InputJsonValue,
          receivedAt: input.receivedAt ?? new Date(),
        },
      });

      return ok(toBankWebhookEvent(row));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return err({
          code: "DUPLICATE_PROVIDER_EVENT",
          message: "Webhook-event finns redan registrerat",
        });
      }
      throw error;
    }
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateBankWebhookEventInput,
  ): Promise<BankWebhookEvent | null> {
    const existing = await this.prisma.bankWebhookEvent.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await this.prisma.bankWebhookEvent.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.processedAt !== undefined && { processedAt: input.processedAt }),
        ...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
      },
    });

    return toBankWebhookEvent(updated);
  }
}
