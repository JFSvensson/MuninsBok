import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Verifikationslista (Voucher List Report)
 * A printable/exportable list of all vouchers with full line details,
 * sorted by voucher number.
 */

export interface VoucherListReportLine {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly debit: number; // ören
  readonly credit: number; // ören
  readonly description?: string;
}

export interface VoucherListReportEntry {
  readonly voucherId: string;
  readonly voucherNumber: number;
  readonly date: Date;
  readonly description: string;
  readonly createdBy?: string;
  readonly lines: readonly VoucherListReportLine[];
  readonly totalDebit: number; // ören
  readonly totalCredit: number; // ören
}

export interface VoucherListReport {
  readonly entries: readonly VoucherListReportEntry[];
  readonly totalDebit: number; // ören
  readonly totalCredit: number; // ören
  readonly count: number;
  readonly generatedAt: Date;
}

/**
 * Generate a Verifikationslista sorted by voucher number.
 */
export function generateVoucherListReport(
  vouchers: readonly Voucher[],
  accounts: readonly Account[]
): VoucherListReport {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Sort by voucher number
  const sorted = [...vouchers].sort((a, b) => a.number - b.number);

  const entries: VoucherListReportEntry[] = sorted.map((v) => {
    const lines: VoucherListReportLine[] = v.lines.map((line) => ({
      accountNumber: line.accountNumber,
      accountName: accountMap.get(line.accountNumber)?.name ?? "Okänt konto",
      debit: line.debit,
      credit: line.credit,
      ...(line.description != null && { description: line.description }),
    }));

    return {
      voucherId: v.id,
      voucherNumber: v.number,
      date: v.date instanceof Date ? v.date : new Date(v.date),
      description: v.description,
      ...(v.createdBy != null && { createdBy: v.createdBy }),
      lines,
      totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
      totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
    };
  });

  return {
    entries,
    totalDebit: entries.reduce((sum, e) => sum + e.totalDebit, 0),
    totalCredit: entries.reduce((sum, e) => sum + e.totalCredit, 0),
    count: entries.length,
    generatedAt: new Date(),
  };
}
