import type { PrismaClient } from "../generated/prisma/client.js";
import { createHash, randomUUID } from "node:crypto";
import type {
  ApprovalStep,
  ApprovalDecisionInput,
  ApprovalError,
  IApprovalStepRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { toApprovalStep } from "../mappers.js";

interface AccountingEventInput {
  organizationId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  requestId?: string;
  payloadSummary?: string;
  payloadHash?: string;
  correctionEventId?: string;
}

async function writeAccountingEvent(
  executor: { $executeRaw: PrismaClient["$executeRaw"] },
  input: AccountingEventInput,
): Promise<void> {
  await executor.$executeRaw`
    INSERT INTO "accounting_events" (
      "id",
      "organization_id",
      "event_type",
      "resource_type",
      "resource_id",
      "user_id",
      "request_id",
      "payload_summary",
      "payload_hash",
      "correction_event_id",
      "occurred_at",
      "created_at"
    )
    VALUES (
      ${randomUUID()},
      ${input.organizationId},
      ${input.eventType},
      ${input.resourceType},
      ${input.resourceId},
      ${input.userId ?? null},
      ${input.requestId ?? null},
      ${input.payloadSummary ?? null},
      ${input.payloadHash ?? null},
      ${input.correctionEventId ?? null},
      NOW(),
      NOW()
    )
  `;
}

export class ApprovalStepRepository implements IApprovalStepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByVoucher(voucherId: string): Promise<ApprovalStep[]> {
    const steps = await this.prisma.approvalStep.findMany({
      where: { voucherId },
      orderBy: { stepOrder: "asc" },
    });
    return steps.map(toApprovalStep);
  }

  async findById(id: string): Promise<ApprovalStep | null> {
    const step = await this.prisma.approvalStep.findUnique({ where: { id } });
    return step ? toApprovalStep(step) : null;
  }

  async findPendingByOrganization(organizationId: string): Promise<ApprovalStep[]> {
    const steps = await this.prisma.approvalStep.findMany({
      where: {
        status: "PENDING",
        voucher: { organizationId },
      },
      orderBy: { createdAt: "asc" },
    });
    return steps.map(toApprovalStep);
  }

  async createMany(
    voucherId: string,
    steps: readonly { stepOrder: number; requiredRole: string }[],
  ): Promise<ApprovalStep[]> {
    // Create in a transaction so all steps are created atomically
    const created = await this.prisma.$transaction(
      steps.map((s) =>
        this.prisma.approvalStep.create({
          data: {
            voucherId,
            stepOrder: s.stepOrder,
            requiredRole: s.requiredRole as "OWNER" | "ADMIN" | "MEMBER",
          },
        }),
      ),
    );
    return created.map(toApprovalStep);
  }

  async decide(input: ApprovalDecisionInput): Promise<Result<ApprovalStep, ApprovalError>> {
    const txResult = await this.prisma.$transaction(async (tx) => {
      const step = await tx.approvalStep.findUnique({
        where: { id: input.stepId },
        include: {
          voucher: {
            select: {
              id: true,
              organizationId: true,
            },
          },
        },
      });

      if (!step) {
        return {
          kind: "error" as const,
          error: { code: "NOT_FOUND" as const, message: "Atteststeget hittades inte" },
        };
      }

      if (step.status !== "PENDING") {
        return {
          kind: "error" as const,
          error: { code: "ALREADY_DECIDED" as const, message: "Steget har redan beslutats" },
        };
      }

      const updated = await tx.approvalStep.update({
        where: { id: input.stepId },
        data: {
          status: input.decision,
          approverUserId: input.userId,
          decidedAt: new Date(),
          ...(input.comment !== undefined && { comment: input.comment }),
        },
      });

      const payloadSummary = JSON.stringify({
        stepId: updated.id,
        voucherId: step.voucher.id,
        decision: input.decision,
        stepOrder: step.stepOrder,
      });

      await writeAccountingEvent(tx, {
        organizationId: step.voucher.organizationId,
        eventType: "APPROVAL_DECISION",
        resourceType: "ApprovalStep",
        resourceId: updated.id,
        userId: input.userId,
        payloadSummary,
        payloadHash: createHash("sha256").update(payloadSummary).digest("hex"),
      });

      return { kind: "ok" as const, updated };
    });

    if (txResult.kind === "error") {
      return err(txResult.error);
    }

    return ok(toApprovalStep(txResult.updated));
  }
}
