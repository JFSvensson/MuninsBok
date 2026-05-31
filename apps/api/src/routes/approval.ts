import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import {
  createApprovalRuleSchema,
  updateApprovalRuleSchema,
  approvalDecisionSchema,
} from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import {
  buildApprovalSteps,
  calculateVoucherTotal,
  canUserApproveStep,
  isNextPendingStep,
  computeVoucherStatus,
} from "@muninsbok/core";

export async function approvalRoutes(fastify: FastifyInstance) {
  const ruleRepo = fastify.repos.approvalRules;
  const stepRepo = fastify.repos.approvalSteps;
  const voucherRepo = fastify.repos.vouchers;

  async function writeAccountingEvent(input: {
    organizationId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    userId?: string;
    requestId?: string;
    payloadSummary?: string;
  }): Promise<void> {
    const executeRaw = fastify.repos.prisma.$executeRaw;
    if (typeof executeRaw !== "function") return;

    const payloadHash =
      input.payloadSummary != null
        ? createHash("sha256").update(input.payloadSummary).digest("hex")
        : null;

    await executeRaw`
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
        ${payloadHash},
        NOW(),
        NOW()
      )
    `;
  }

  // ── Approval Rules (ADMIN+) ──────────────────────────────

  // List all approval rules for the organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/approval-rules", async (request) => {
    const rules = await ruleRepo.findByOrganization(request.params.orgId);
    return { data: rules };
  });

  // Create an approval rule
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/approval-rules",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const input = parseBody(createApprovalRuleSchema, request.body);
      const result = await ruleRepo.create(request.params.orgId, input);

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }
      return reply.status(201).send({ data: result.value });
    },
  );

  // Update an approval rule
  fastify.put<{ Params: { orgId: string; ruleId: string } }>(
    "/:orgId/approval-rules/:ruleId",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const input = parseBody(updateApprovalRuleSchema, request.body);
      const result = await ruleRepo.update(request.params.ruleId, request.params.orgId, input);

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }
      return { data: result.value };
    },
  );

  // Delete an approval rule
  fastify.delete<{ Params: { orgId: string; ruleId: string } }>(
    "/:orgId/approval-rules/:ruleId",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const deleted = await ruleRepo.delete(request.params.ruleId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Regeln hittades inte" });
      }
      return reply.status(204).send();
    },
  );

  // ── Voucher Approval Workflow ─────────────────────────────

  // Submit a voucher for approval
  fastify.post<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId/submit",
    async (request, reply) => {
      const { orgId, voucherId } = request.params;
      const userId = request.user?.sub;

      const voucher = await voucherRepo.findById(voucherId, orgId);
      if (!voucher) {
        return reply.status(404).send({ error: "Verifikatet hittades inte" });
      }

      if (voucher.status !== "DRAFT") {
        return reply.status(400).send({ error: "Verifikatet är inte i utkast-status" });
      }

      // Determine which approval steps are needed
      const rules = await ruleRepo.findByOrganization(orgId);
      const total = calculateVoucherTotal(voucher.lines);
      const stepDefs = buildApprovalSteps(rules, total);

      if (stepDefs.length === 0) {
        // No rules match — auto-approve
        // Update voucher status directly via prisma
        await fastify.repos.prisma.voucher.update({
          where: { id: voucherId },
          data: {
            status: "APPROVED",
            submittedAt: new Date(),
            submittedByUserId: userId,
          },
        });

        await writeAccountingEvent({
          organizationId: orgId,
          eventType: "VOUCHER_AUTO_APPROVED",
          resourceType: "Voucher",
          resourceId: voucherId,
          ...(userId != null && { userId }),
          requestId: request.id,
          payloadSummary: JSON.stringify({
            voucherId,
            fromStatus: voucher.status,
            toStatus: "APPROVED",
            reason: "NO_MATCHING_APPROVAL_RULES",
          }),
        });

        const updated = await voucherRepo.findById(voucherId, orgId);
        return { data: updated };
      }

      // Create approval steps and set voucher to PENDING
      await stepRepo.createMany(voucherId, stepDefs);
      await fastify.repos.prisma.voucher.update({
        where: { id: voucherId },
        data: {
          status: "PENDING",
          submittedAt: new Date(),
          submittedByUserId: userId,
        },
      });

      await writeAccountingEvent({
        organizationId: orgId,
        eventType: "VOUCHER_SUBMITTED",
        resourceType: "Voucher",
        resourceId: voucherId,
        ...(userId != null && { userId }),
        requestId: request.id,
        payloadSummary: JSON.stringify({
          voucherId,
          fromStatus: voucher.status,
          toStatus: "PENDING",
          approvalStepCount: stepDefs.length,
        }),
      });

      const updated = await voucherRepo.findById(voucherId, orgId);
      return { data: updated };
    },
  );

  // Approve or reject an approval step
  fastify.post<{ Params: { orgId: string; voucherId: string; stepId: string } }>(
    "/:orgId/vouchers/:voucherId/approval-steps/:stepId/decide",
    async (request, reply) => {
      const { orgId, voucherId, stepId } = request.params;
      const userId = request.user?.sub;
      const input = parseBody(approvalDecisionSchema, request.body);

      const voucher = await voucherRepo.findById(voucherId, orgId);
      if (!voucher) {
        return reply.status(404).send({ error: "Verifikatet hittades inte" });
      }

      if (voucher.status !== "PENDING") {
        return reply.status(400).send({ error: "Verifikatet väntar inte på godkännande" });
      }

      // Verify the step belongs to this voucher
      const allSteps = await stepRepo.findByVoucher(voucherId);
      const step = allSteps.find((s) => s.id === stepId);
      if (!step) {
        return reply.status(404).send({ error: "Atteststeget hittades inte" });
      }

      // Check this is the next step in order
      if (!isNextPendingStep(step, allSteps)) {
        return reply
          .status(400)
          .send({ error: "Det finns tidigare steg som ännu inte har beslutats" });
      }

      // Check authorization
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const membership = request.membership!;
      if (!canUserApproveStep(step, membership.role)) {
        return reply
          .status(403)
          .send({ error: `Rollen ${step.requiredRole} eller högre krävs för detta steg` });
      }

      // Record decision
      const result = await stepRepo.decide({
        stepId,
        userId,
        requestId: request.id,
        decision: input.decision,
        ...(input.comment != null && { comment: input.comment }),
      });

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      // Compute new voucher status
      const updatedSteps = await stepRepo.findByVoucher(voucherId);
      const newStatus = computeVoucherStatus(updatedSteps);

      if (newStatus !== voucher.status) {
        await fastify.repos.prisma.voucher.update({
          where: { id: voucherId },
          data: { status: newStatus },
        });

        await writeAccountingEvent({
          organizationId: orgId,
          eventType: "VOUCHER_STATUS_CHANGED",
          resourceType: "Voucher",
          resourceId: voucherId,
          ...(userId != null && { userId }),
          requestId: request.id,
          payloadSummary: JSON.stringify({
            voucherId,
            fromStatus: voucher.status,
            toStatus: newStatus,
            decision: input.decision,
            stepId,
          }),
        });
      }

      const updated = await voucherRepo.findById(voucherId, orgId);
      return { data: updated };
    },
  );

  // List pending approval steps for the organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/approval-steps/pending", async (request) => {
    const steps = await stepRepo.findPendingByOrganization(request.params.orgId);
    return { data: steps };
  });

  // List approval steps for a specific voucher
  fastify.get<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId/approval-steps",
    async (request, reply) => {
      const { orgId, voucherId } = request.params;

      const voucher = await voucherRepo.findById(voucherId, orgId);
      if (!voucher) {
        return reply.status(404).send({ error: "Verifikatet hittades inte" });
      }

      const steps = await stepRepo.findByVoucher(voucherId);
      return { data: steps };
    },
  );
}
