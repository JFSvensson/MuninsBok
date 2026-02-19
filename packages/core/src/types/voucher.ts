import type { VoucherLine, CreateVoucherLineInput } from "./voucher-line.js";

/**
 * Voucher - ett verifikat/bokföringspost.
 */
export interface Voucher {
  readonly id: string;
  readonly fiscalYearId: string;
  readonly organizationId: string;
  /** Verifikatnummer inom räkenskapsåret */
  readonly number: number;
  /** Verifikatdatum */
  readonly date: Date;
  /** Beskrivning av verifikatet */
  readonly description: string;
  /** Verifikatrader */
  readonly lines: readonly VoucherLine[];
  /** Kopplade dokument-ID:n */
  readonly documentIds: readonly string[];
  /** Vem som skapade verifikatet */
  readonly createdBy?: string;
  /** ID på verifikatet som detta verifikat rättar */
  readonly correctsVoucherId?: string;
  /** ID på verifikatet som rättar detta verifikat */
  readonly correctedByVoucherId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateVoucherInput {
  readonly fiscalYearId: string;
  readonly organizationId: string;
  readonly date: Date;
  readonly description: string;
  readonly lines: readonly CreateVoucherLineInput[];
  readonly documentIds?: readonly string[];
  readonly createdBy?: string;
}

export type VoucherErrorCode =
  | "UNBALANCED"
  | "NO_LINES"
  | "INVALID_DATE"
  | "FISCAL_YEAR_CLOSED"
  | "INVALID_LINE"
  | "ACCOUNT_NOT_FOUND"
  | "NOT_FOUND"
  | "ALREADY_CORRECTED";

export interface VoucherError {
  readonly code: VoucherErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/** Calculate total debit for voucher lines */
export function calculateTotalDebit(lines: readonly CreateVoucherLineInput[]): number {
  return lines.reduce((sum, line) => sum + line.debit, 0);
}

/** Calculate total credit for voucher lines */
export function calculateTotalCredit(lines: readonly CreateVoucherLineInput[]): number {
  return lines.reduce((sum, line) => sum + line.credit, 0);
}

/** Check if voucher is balanced (debit === credit) */
export function isVoucherBalanced(lines: readonly CreateVoucherLineInput[]): boolean {
  return calculateTotalDebit(lines) === calculateTotalCredit(lines);
}
