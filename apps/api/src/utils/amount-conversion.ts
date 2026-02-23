/**
 * Helpers for converting domain amounts (öre / integer cents) to
 * API response amounts (kronor / decimal SEK).
 *
 * Centralises the `/ 100` arithmetic so report routes stay declarative.
 */

/** Convert a single öre value to kronor. */
export function öreToKronor(öre: number): number {
  return öre / 100;
}

/**
 * Convert debit / credit fields in a row-like object from öre to kronor.
 * Preserves all other properties via spread.
 */
export function convertDebitCredit<T extends { debit: number; credit: number }>(row: T): T {
  return { ...row, debit: row.debit / 100, credit: row.credit / 100 };
}

/**
 * Convert an "amount section" (income statement / VAT style) from öre to kronor.
 * Each row has an `amount` field; the section has a `total`.
 */
export function convertAmountSection<
  T extends { rows: readonly { amount: number }[]; total: number },
>(section: T): T {
  return {
    ...section,
    rows: section.rows.map((row) => ({ ...row, amount: row.amount / 100 })),
    total: section.total / 100,
  } as T;
}

/**
 * Convert a balance-sheet section from öre to kronor.
 * Core rows have `balance`; the API contract exposes `amount` instead.
 */
export function convertBalanceSection(section: {
  title: string;
  rows: readonly { accountNumber: string; accountName: string; balance: number }[];
  total: number;
}): {
  title: string;
  rows: { accountNumber: string; accountName: string; amount: number }[];
  total: number;
} {
  return {
    title: section.title,
    rows: section.rows.map((row) => ({
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      amount: row.balance / 100,
    })),
    total: section.total / 100,
  };
}
