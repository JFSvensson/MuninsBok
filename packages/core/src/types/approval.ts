/**
 * Approval workflow types for voucher attestation (attestflöde).
 */

import type { MemberRole } from "./user.js";

// ── Enums ───────────────────────────────────────────────────

export type VoucherStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalStepStatus = "PENDING" | "APPROVED" | "REJECTED";

// ── Approval Rule ───────────────────────────────────────────

export interface ApprovalRule {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  /** Minimum voucher total (in öre) for this rule to apply. */
  readonly minAmount: number;
  /** Maximum voucher total (in öre), null = no upper limit. */
  readonly maxAmount: number | null;
  /** Role required to approve at this step. */
  readonly requiredRole: MemberRole;
  /** Defines order of approval — lower = first. */
  readonly stepOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateApprovalRuleInput {
  readonly name: string;
  readonly minAmount: number;
  readonly maxAmount?: number | null | undefined;
  readonly requiredRole: MemberRole;
  readonly stepOrder: number;
}

export interface UpdateApprovalRuleInput {
  readonly name?: string | undefined;
  readonly minAmount?: number | undefined;
  readonly maxAmount?: number | null | undefined;
  readonly requiredRole?: MemberRole | undefined;
  readonly stepOrder?: number | undefined;
}

export type ApprovalRuleErrorCode = "NOT_FOUND" | "INVALID_AMOUNT_RANGE" | "DUPLICATE_STEP_ORDER";

export interface ApprovalRuleError {
  readonly code: ApprovalRuleErrorCode;
  readonly message: string;
}

// ── Approval Step (per-voucher) ─────────────────────────────

export interface ApprovalStep {
  readonly id: string;
  readonly voucherId: string;
  readonly stepOrder: number;
  readonly requiredRole: MemberRole;
  readonly approverUserId: string | null;
  readonly status: ApprovalStepStatus;
  readonly comment: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
}

export interface ApprovalDecisionInput {
  readonly stepId: string;
  readonly userId: string;
  readonly decision: "APPROVED" | "REJECTED";
  readonly comment?: string;
}

export type ApprovalErrorCode =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "NOT_AUTHORIZED"
  | "WRONG_STEP_ORDER"
  | "VOUCHER_NOT_PENDING";

export interface ApprovalError {
  readonly code: ApprovalErrorCode;
  readonly message: string;
}
