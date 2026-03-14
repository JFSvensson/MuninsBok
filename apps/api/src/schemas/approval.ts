import { z } from "zod";

const memberRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const createApprovalRuleSchema = z.object({
  name: z.string().min(1).max(255),
  minAmount: z.number().int().min(0),
  maxAmount: z.number().int().min(0).nullable().optional(),
  requiredRole: memberRoleEnum,
  stepOrder: z.number().int().min(1),
});

export const updateApprovalRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  minAmount: z.number().int().min(0).optional(),
  maxAmount: z.number().int().min(0).nullable().optional(),
  requiredRole: memberRoleEnum.optional(),
  stepOrder: z.number().int().min(1).optional(),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(1000).optional(),
});
