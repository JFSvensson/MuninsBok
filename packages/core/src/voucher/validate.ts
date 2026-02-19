import type { Account } from "../types/account.js";
import type { CreateVoucherInput, Voucher, VoucherError } from "../types/voucher.js";
import type { FiscalYear } from "../types/fiscal-year.js";
import { isVoucherBalanced, calculateTotalDebit } from "../types/voucher.js";
import { validateVoucherLine } from "../types/voucher-line.js";
import { isValidAccountNumber } from "../types/account.js";
import { isDateInFiscalYear } from "../types/fiscal-year.js";
import { ok, err, type Result } from "../types/result.js";

export interface ValidateVoucherContext {
  readonly fiscalYear: FiscalYear;
  readonly accounts: readonly Account[];
}

/**
 * Validate a voucher input.
 * Returns Ok(true) if valid, or Err with the validation error.
 */
export function validateVoucher(
  input: CreateVoucherInput,
  context: ValidateVoucherContext,
): Result<true, VoucherError> {
  // Check for empty lines
  if (input.lines.length === 0) {
    return err({
      code: "NO_LINES",
      message: "Verifikatet måste ha minst en rad",
    });
  }

  // Check fiscal year is not closed
  if (context.fiscalYear.isClosed) {
    return err({
      code: "FISCAL_YEAR_CLOSED",
      message: "Räkenskapsåret är stängt för ändringar",
    });
  }

  // Check date is within fiscal year
  if (!isDateInFiscalYear(input.date, context.fiscalYear)) {
    return err({
      code: "INVALID_DATE",
      message: `Verifikatdatum ${input.date.toISOString().slice(0, 10)} ligger utanför räkenskapsåret`,
    });
  }

  // Build account number set for quick lookup
  const accountNumbers = new Set(context.accounts.map((a) => a.number));

  // Validate each line
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;

    // Validate line amounts
    const lineError = validateVoucherLine(line);
    if (lineError) {
      return err({
        code: "INVALID_LINE",
        message: `Rad ${i + 1}: ${lineError.message}`,
        details: { lineIndex: i, lineError },
      });
    }

    // Validate account number format
    if (!isValidAccountNumber(line.accountNumber)) {
      return err({
        code: "INVALID_LINE",
        message: `Rad ${i + 1}: Ogiltigt kontonummer "${line.accountNumber}"`,
        details: { lineIndex: i },
      });
    }

    // Check account exists
    if (!accountNumbers.has(line.accountNumber)) {
      return err({
        code: "ACCOUNT_NOT_FOUND",
        message: `Rad ${i + 1}: Kontot ${line.accountNumber} finns inte i kontoplanen`,
        details: { lineIndex: i, accountNumber: line.accountNumber },
      });
    }
  }

  // Check balance
  if (!isVoucherBalanced(input.lines)) {
    const totalDebit = calculateTotalDebit(input.lines);
    const totalCredit = input.lines.reduce((sum, l) => sum + l.credit, 0);
    return err({
      code: "UNBALANCED",
      message: `Verifikatet balanserar inte: debet ${totalDebit / 100} kr, kredit ${totalCredit / 100} kr`,
      details: { totalDebit, totalCredit, difference: totalDebit - totalCredit },
    });
  }

  return ok(true);
}

/**
 * Create a voucher from validated input.
 * Assumes validation has already passed.
 * Returns the domain voucher object with generated ID and number.
 */
export interface CreateVoucherOptions {
  readonly id: string;
  readonly voucherNumber: number;
  readonly lineIdGenerator: () => string;
}

export function createVoucherFromInput(
  input: CreateVoucherInput,
  options: CreateVoucherOptions,
): Voucher {
  const now = new Date();

  return {
    id: options.id,
    fiscalYearId: input.fiscalYearId,
    organizationId: input.organizationId,
    number: options.voucherNumber,
    date: input.date,
    description: input.description,
    lines: input.lines.map((line) => ({
      id: options.lineIdGenerator(),
      voucherId: options.id,
      accountNumber: line.accountNumber,
      debit: line.debit,
      credit: line.credit,
      ...(line.description !== undefined && { description: line.description }),
    })),
    documentIds: input.documentIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}
