import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Grundbok (Journal) – BFL 5:1
 * Chronological listing of all vouchers and their lines,
 * sorted by date then voucher number.
 */

export interface JournalLine {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly debit: number; // ören
  readonly credit: number; // ören
  readonly description?: string;
}

export interface JournalEntry {
  readonly voucherId: string;
  readonly voucherNumber: number;
  readonly date: Date;
  readonly description: string;
  readonly lines: readonly JournalLine[];
  readonly totalDebit: number; // ören
  readonly totalCredit: number; // ören
}

export interface Journal {
  readonly entries: readonly JournalEntry[];
  readonly totalDebit: number; // ören
  readonly totalCredit: number; // ören
  readonly generatedAt: Date;
}

/**
 * Generate a Grundbok (Journal) from vouchers, sorted chronologically.
 */
export function generateJournal(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): Journal {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Sort chronologically, then by voucher number
  const sorted = [...vouchers].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.number - b.number;
  });

  const entries: JournalEntry[] = sorted.map((v) => {
    const lines: JournalLine[] = v.lines.map((line) => ({
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
      lines,
      totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
      totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
    };
  });

  return {
    entries,
    totalDebit: entries.reduce((sum, e) => sum + e.totalDebit, 0),
    totalCredit: entries.reduce((sum, e) => sum + e.totalCredit, 0),
    generatedAt: new Date(),
  };
}
