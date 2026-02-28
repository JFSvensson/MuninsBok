import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Year-End Closing Preview (Boksluts-förhandsvisning)
 *
 * Pure function that calculates what a closing voucher (bokslutsverifikat)
 * would look like before actually executing the close. Gives the user
 * full visibility into the closing entries, result summary, and balance
 * check before committing to a year-end close.
 *
 * All monetary amounts are in öre (integer cents).
 */

// ── Types ───────────────────────────────────────────────────

export interface ClosingEntryLine {
  readonly accountNumber: string;
  readonly accountName: string;
  /** Current balance before closing (credit − debit) in öre */
  readonly currentBalance: number;
  /** Debit amount in the closing voucher – öre */
  readonly closingDebit: number;
  /** Credit amount in the closing voucher – öre */
  readonly closingCredit: number;
}

export interface ClosingPreviewSection {
  readonly title: string;
  readonly lines: readonly ClosingEntryLine[];
  readonly total: number;
}

export interface ClosingPreview {
  /** Revenue accounts being closed (3000–3999) */
  readonly revenues: ClosingPreviewSection;
  /** Operating expense accounts being closed (4000–7999) */
  readonly expenses: ClosingPreviewSection;
  /** Financial income accounts being closed (8000–8399) */
  readonly financialIncome: ClosingPreviewSection;
  /** Financial expense accounts being closed (8400–8999) */
  readonly financialExpenses: ClosingPreviewSection;
  /** The result line booked to 2099 (Årets resultat) */
  readonly resultEntry: {
    readonly accountNumber: string;
    readonly accountName: string;
    readonly debit: number;
    readonly credit: number;
  };
  /** Summary totals */
  readonly totalRevenues: number;
  readonly totalExpenses: number;
  readonly operatingResult: number;
  readonly totalFinancialIncome: number;
  readonly totalFinancialExpenses: number;
  /** Net result for the year (positive = profit, negative = loss) */
  readonly netResult: number;
  /** Total number of P&L accounts that will be closed */
  readonly accountCount: number;
  /** Whether the closing voucher balances (debit == credit). Should always be true. */
  readonly isBalanced: boolean;
  /** Whether there are any P&L balances to close */
  readonly hasEntries: boolean;
  readonly generatedAt: Date;
}

// ── Account range helpers ───────────────────────────────────

const REVENUE_RANGE = { start: 3000, end: 3999 };
const EXPENSE_RANGE = { start: 4000, end: 7999 };
const FINANCIAL_INCOME_RANGE = { start: 8000, end: 8399 };
const FINANCIAL_EXPENSE_RANGE = { start: 8400, end: 8999 };

function isInRange(num: number, range: { start: number; end: number }): boolean {
  return num >= range.start && num <= range.end;
}

function isPL(num: number): boolean {
  return num >= 3000 && num <= 8999;
}

// ── Main calculation ────────────────────────────────────────

/**
 * Calculate what the closing entries would look like for a fiscal year.
 *
 * @param vouchers – all vouchers in the fiscal year (pre-filtered)
 * @param accounts – all accounts for the organization
 */
export function calculateClosingPreview(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): ClosingPreview {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Aggregate P&L balances: credit − debit (natural for revenues)
  const plBalances = new Map<string, number>();

  for (const v of vouchers) {
    for (const line of v.lines) {
      const num = parseInt(line.accountNumber, 10);
      if (isPL(num)) {
        const existing = plBalances.get(line.accountNumber) ?? 0;
        plBalances.set(line.accountNumber, existing + line.credit - line.debit);
      }
    }
  }

  // Build closing entry lines per section
  function buildSection(
    title: string,
    range: { start: number; end: number },
  ): ClosingPreviewSection {
    const lines: ClosingEntryLine[] = [];

    for (const [accountNumber, balance] of plBalances) {
      const num = parseInt(accountNumber, 10);
      if (!isInRange(num, range) || balance === 0) continue;

      const account = accountMap.get(accountNumber);
      // Reverse the balance: positive balance → debit, negative → credit
      lines.push({
        accountNumber,
        accountName: account?.name ?? "Okänt konto",
        currentBalance: balance,
        closingDebit: balance > 0 ? balance : 0,
        closingCredit: balance < 0 ? -balance : 0,
      });
    }

    lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    const total = lines.reduce((s, l) => s + l.currentBalance, 0);

    return { title, lines, total };
  }

  const revenues = buildSection("Intäkter (3000–3999)", REVENUE_RANGE);
  const expenses = buildSection("Kostnader (4000–7999)", EXPENSE_RANGE);
  const financialIncome = buildSection("Finansiella intäkter (8000–8399)", FINANCIAL_INCOME_RANGE);
  const financialExpenses = buildSection(
    "Finansiella kostnader (8400–8999)",
    FINANCIAL_EXPENSE_RANGE,
  );

  // Net result = sum of all P&L balances (credit − debit)
  // Positive = profit (revenues > expenses)
  const netResult =
    revenues.total + expenses.total + financialIncome.total + financialExpenses.total;
  const operatingResult = revenues.total + expenses.total;

  // Revenue totals (natural sign: positive = revenue)
  const totalRevenues = revenues.total;
  // Expense total: shown as positive cost (invert sign)
  const totalExpenses = -(expenses.total + financialExpenses.total);
  const totalFinancialIncome = financialIncome.total;
  const totalFinancialExpenses = -financialExpenses.total;

  // Result entry: book net result to 2099
  const resultEntry = {
    accountNumber: "2099",
    accountName: "Årets resultat",
    debit: netResult < 0 ? -netResult : 0,
    credit: netResult > 0 ? netResult : 0,
  };

  // Count non-zero P&L accounts
  const accountCount = [...plBalances.values()].filter((b) => b !== 0).length;

  // Balance check: total closing debits == total closing credits
  const allSections = [revenues, expenses, financialIncome, financialExpenses];
  const totalClosingDebit =
    allSections.reduce((s, sec) => s + sec.lines.reduce((ss, l) => ss + l.closingDebit, 0), 0) +
    resultEntry.debit;
  const totalClosingCredit =
    allSections.reduce((s, sec) => s + sec.lines.reduce((ss, l) => ss + l.closingCredit, 0), 0) +
    resultEntry.credit;

  return {
    revenues,
    expenses,
    financialIncome,
    financialExpenses,
    resultEntry,
    totalRevenues,
    totalExpenses,
    operatingResult,
    totalFinancialIncome,
    totalFinancialExpenses,
    netResult,
    accountCount,
    isBalanced: totalClosingDebit === totalClosingCredit,
    hasEntries: accountCount > 0,
    generatedAt: new Date(),
  };
}
