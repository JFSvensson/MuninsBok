import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ApprovalRule,
  CreateApprovalRuleInput,
  UpdateApprovalRuleInput,
  ApprovalRuleError,
  IApprovalRuleRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { toApprovalRule } from "../mappers.js";

export class ApprovalRuleRepository implements IApprovalRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<ApprovalRule[]> {
    const rules = await this.prisma.approvalRule.findMany({
      where: { organizationId },
      orderBy: { stepOrder: "asc" },
    });
    return rules.map(toApprovalRule);
  }

  async findById(id: string, organizationId: string): Promise<ApprovalRule | null> {
    const rule = await this.prisma.approvalRule.findFirst({
      where: { id, organizationId },
    });
    return rule ? toApprovalRule(rule) : null;
  }

  async findMatchingRules(organizationId: string, totalAmount: number): Promise<ApprovalRule[]> {
    const rules = await this.prisma.approvalRule.findMany({
      where: {
        organizationId,
        minAmount: { lte: totalAmount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: totalAmount } }],
      },
      orderBy: { stepOrder: "asc" },
    });
    return rules.map(toApprovalRule);
  }

  async create(
    organizationId: string,
    input: CreateApprovalRuleInput,
  ): Promise<Result<ApprovalRule, ApprovalRuleError>> {
    if (input.maxAmount != null && input.maxAmount < input.minAmount) {
      return err({
        code: "INVALID_AMOUNT_RANGE",
        message: "Maxbelopp måste vara större än eller lika med minbelopp",
      });
    }

    const existing = await this.prisma.approvalRule.findFirst({
      where: { organizationId, stepOrder: input.stepOrder },
    });
    if (existing) {
      return err({
        code: "DUPLICATE_STEP_ORDER",
        message: `Steg ${input.stepOrder} finns redan`,
      });
    }

    const rule = await this.prisma.approvalRule.create({
      data: {
        organizationId,
        name: input.name,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount ?? null,
        requiredRole: input.requiredRole,
        stepOrder: input.stepOrder,
      },
    });
    return ok(toApprovalRule(rule));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateApprovalRuleInput,
  ): Promise<Result<ApprovalRule, ApprovalRuleError>> {
    const existing = await this.prisma.approvalRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Regeln hittades inte" });
    }

    const minAmount = input.minAmount ?? existing.minAmount;
    const maxAmount =
      input.maxAmount !== undefined ? (input.maxAmount ?? null) : existing.maxAmount;

    if (maxAmount != null && maxAmount < minAmount) {
      return err({
        code: "INVALID_AMOUNT_RANGE",
        message: "Maxbelopp måste vara större än eller lika med minbelopp",
      });
    }

    if (input.stepOrder != null && input.stepOrder !== existing.stepOrder) {
      const conflict = await this.prisma.approvalRule.findFirst({
        where: { organizationId, stepOrder: input.stepOrder, id: { not: id } },
      });
      if (conflict) {
        return err({
          code: "DUPLICATE_STEP_ORDER",
          message: `Steg ${input.stepOrder} finns redan`,
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data["name"] = input.name;
    if (input.minAmount !== undefined) data["minAmount"] = input.minAmount;
    if (input.maxAmount !== undefined) data["maxAmount"] = input.maxAmount ?? null;
    if (input.requiredRole !== undefined) data["requiredRole"] = input.requiredRole;
    if (input.stepOrder !== undefined) data["stepOrder"] = input.stepOrder;

    const rule = await this.prisma.approvalRule.update({
      where: { id },
      data,
    });
    return ok(toApprovalRule(rule));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.prisma.approvalRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return false;
    await this.prisma.approvalRule.delete({ where: { id } });
    return true;
  }
}
