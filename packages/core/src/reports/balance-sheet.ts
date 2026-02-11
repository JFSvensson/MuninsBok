import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Balance Sheet (Balansräkning)
 * Shows assets, liabilities, and equity.
 * Swedish: Tillgångar (1xxx) = Skulder (2xxx) + Eget kapital
 */

export interface BalanceSheetRow {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly balance: number; // In ören
}

export interface BalanceSheetSection {
  readonly title: string;
  readonly rows: readonly BalanceSheetRow[];
  readonly total: number;
}

export interface BalanceSheet {
  readonly assets: BalanceSheetSection;
  readonly liabilities: BalanceSheetSection;
  readonly equity: BalanceSheetSection;
  readonly totalAssets: number;
  readonly totalLiabilitiesAndEquity: number;
  /** Difference (should be 0 if balanced, includes year's result) */
  readonly difference: number;
  /** Current year's result (added to equity) */
  readonly yearResult: number;
  readonly generatedAt: Date;
}

/** Account ranges */
const ASSET_RANGE = { start: 1000, end: 1999 };
const LIABILITY_RANGE = { start: 2000, end: 2799 }; // Skulder
const EQUITY_RANGE = { start: 2080, end: 2099 }; // Eget kapital (subset of 2xxx)

// For year result calculation
const INCOME_STATEMENT_RANGE = { start: 3000, end: 8999 };

function isInRange(
  accountNumber: string,
  range: { start: number; end: number }
): boolean {
  const num = parseInt(accountNumber, 10);
  return num >= range.start && num <= range.end;
}

/**
 * Calculate balance sheet from vouchers.
 * Includes year's result from income statement accounts.
 */
export function calculateBalanceSheet(
  vouchers: readonly Voucher[],
  accounts: readonly Account[]
): BalanceSheet {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Aggregate balances per account
  // Assets: debit = increase, so balance = debit - credit
  // Liabilities/Equity: credit = increase, so balance = credit - debit
  const rawBalances = new Map<string, { debit: number; credit: number }>();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const existing = rawBalances.get(line.accountNumber) ?? {
        debit: 0,
        credit: 0,
      };
      rawBalances.set(line.accountNumber, {
        debit: existing.debit + line.debit,
        credit: existing.credit + line.credit,
      });
    }
  }

  // Helper to build section
  function buildSection(
    title: string,
    range: { start: number; end: number },
    excludeRange?: { start: number; end: number },
    naturalDebit: boolean = true
  ): BalanceSheetSection {
    const rows: BalanceSheetRow[] = [];

    for (const [accountNumber, raw] of rawBalances) {
      if (!isInRange(accountNumber, range)) continue;
      if (excludeRange && isInRange(accountNumber, excludeRange)) continue;

      // Calculate balance based on natural balance direction
      const balance = naturalDebit
        ? raw.debit - raw.credit // Assets: debit balance
        : raw.credit - raw.debit; // Liabilities/Equity: credit balance

      if (balance !== 0) {
        const account = accountMap.get(accountNumber);
        rows.push({
          accountNumber,
          accountName: account?.name ?? "Okänt konto",
          balance,
        });
      }
    }

    rows.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    const total = rows.reduce((sum, row) => sum + row.balance, 0);

    return { title, rows, total };
  }

  // Calculate year's result from P&L accounts
  let yearResult = 0;
  for (const [accountNumber, raw] of rawBalances) {
    if (isInRange(accountNumber, INCOME_STATEMENT_RANGE)) {
      yearResult += raw.credit - raw.debit;
    }
  }

  const assets = buildSection("Tillgångar", ASSET_RANGE, undefined, true);

  // Liabilities exclude equity accounts
  const liabilities = buildSection(
    "Skulder",
    LIABILITY_RANGE,
    EQUITY_RANGE,
    false
  );

  const equity = buildSection("Eget kapital", EQUITY_RANGE, undefined, false);

  const totalAssets = assets.total;
  const totalLiabilitiesAndEquity = liabilities.total + equity.total + yearResult;
  const difference = totalAssets - totalLiabilitiesAndEquity;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilitiesAndEquity,
    difference,
    yearResult,
    generatedAt: new Date(),
  };
}
