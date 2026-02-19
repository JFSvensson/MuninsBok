import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Huvudbok (General Ledger) – BFL 5:1
 * Groups all transactions by account with a running balance per account.
 */

export interface GeneralLedgerTransaction {
  readonly voucherId: string;
  readonly voucherNumber: number;
  readonly date: Date;
  readonly description: string;
  readonly debit: number; // ören
  readonly credit: number; // ören
  readonly balance: number; // ören (running balance)
}

export interface GeneralLedgerAccount {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly transactions: readonly GeneralLedgerTransaction[];
  readonly totalDebit: number; // ören
  readonly totalCredit: number; // ören
  readonly closingBalance: number; // ören
}

export interface GeneralLedger {
  readonly accounts: readonly GeneralLedgerAccount[];
  readonly generatedAt: Date;
}

/**
 * Generate a Huvudbok (General Ledger) from vouchers.
 * Groups by account, sorted by account number, with transactions sorted by date.
 */
export function generateGeneralLedger(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): GeneralLedger {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Collect transactions per account
  const accountTransactions = new Map<
    string,
    Array<{
      voucherId: string;
      voucherNumber: number;
      date: Date;
      description: string;
      debit: number;
      credit: number;
    }>
  >();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const txns = accountTransactions.get(line.accountNumber) ?? [];
      txns.push({
        voucherId: voucher.id,
        voucherNumber: voucher.number,
        date: voucher.date instanceof Date ? voucher.date : new Date(voucher.date),
        description: voucher.description,
        debit: line.debit,
        credit: line.credit,
      });
      accountTransactions.set(line.accountNumber, txns);
    }
  }

  // Build ledger accounts sorted by account number
  const sortedAccountNumbers = [...accountTransactions.keys()].sort();

  const ledgerAccounts: GeneralLedgerAccount[] = sortedAccountNumbers.map((accountNumber) => {
    const txns = accountTransactions.get(accountNumber)!;

    // Sort transactions by date then voucher number
    txns.sort((a, b) => {
      const dateA = a.date.getTime();
      const dateB = b.date.getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.voucherNumber - b.voucherNumber;
    });

    // Build transactions with running balance
    let runningBalance = 0;
    const transactions: GeneralLedgerTransaction[] = txns.map((txn) => {
      runningBalance += txn.debit - txn.credit;
      return {
        voucherId: txn.voucherId,
        voucherNumber: txn.voucherNumber,
        date: txn.date,
        description: txn.description,
        debit: txn.debit,
        credit: txn.credit,
        balance: runningBalance,
      };
    });

    const totalDebit = txns.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = txns.reduce((sum, t) => sum + t.credit, 0);

    return {
      accountNumber,
      accountName: accountMap.get(accountNumber)?.name ?? "Okänt konto",
      transactions,
      totalDebit,
      totalCredit,
      closingBalance: totalDebit - totalCredit,
    };
  });

  return {
    accounts: ledgerAccounts,
    generatedAt: new Date(),
  };
}
