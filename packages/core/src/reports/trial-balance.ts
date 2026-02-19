import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Trial Balance (Råbalans)
 * Shows debit and credit totals for each account.
 */

export interface TrialBalanceRow {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly debit: number; // Total debit in ören
  readonly credit: number; // Total credit in ören
  readonly balance: number; // Debit - Credit (positive = debit balance)
}

export interface TrialBalance {
  readonly rows: readonly TrialBalanceRow[];
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly generatedAt: Date;
}

/**
 * Calculate trial balance from vouchers.
 * @param vouchers All vouchers to include
 * @param accounts Chart of accounts for names
 */
export function calculateTrialBalance(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): TrialBalance {
  // Create a map for quick account name lookup
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Aggregate totals per account
  const totals = new Map<string, { debit: number; credit: number }>();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const existing = totals.get(line.accountNumber) ?? { debit: 0, credit: 0 };
      totals.set(line.accountNumber, {
        debit: existing.debit + line.debit,
        credit: existing.credit + line.credit,
      });
    }
  }

  // Build rows sorted by account number
  const rows: TrialBalanceRow[] = [];
  const sortedAccountNumbers = [...totals.keys()].sort();

  for (const accountNumber of sortedAccountNumbers) {
    const totalsEntry = totals.get(accountNumber)!;
    const account = accountMap.get(accountNumber);

    rows.push({
      accountNumber,
      accountName: account?.name ?? "Okänt konto",
      debit: totalsEntry.debit,
      credit: totalsEntry.credit,
      balance: totalsEntry.debit - totalsEntry.credit,
    });
  }

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    generatedAt: new Date(),
  };
}
