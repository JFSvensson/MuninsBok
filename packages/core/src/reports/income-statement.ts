import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Income Statement (Resultaträkning)
 * Shows revenues and expenses, calculating profit/loss.
 * Swedish: Intäkter (3xxx) minus Kostnader (4xxx-8xxx)
 */

export interface IncomeStatementRow {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly amount: number; // Net amount in ören (positive = revenue/increase)
}

export interface IncomeStatementSection {
  readonly title: string;
  readonly rows: readonly IncomeStatementRow[];
  readonly total: number;
}

export interface IncomeStatement {
  readonly revenues: IncomeStatementSection;
  readonly expenses: IncomeStatementSection;
  readonly operatingResult: number; // Rörelseresultat
  readonly financialIncome: IncomeStatementSection;
  readonly financialExpenses: IncomeStatementSection;
  readonly netResult: number; // Årets resultat
  readonly generatedAt: Date;
}

/** Account ranges for different categories */
const REVENUE_RANGE = { start: 3000, end: 3999 };
const EXPENSE_RANGE = { start: 4000, end: 7999 };
const FINANCIAL_INCOME_RANGE = { start: 8000, end: 8399 };
const FINANCIAL_EXPENSE_RANGE = { start: 8400, end: 8999 };

function isInRange(accountNumber: string, range: { start: number; end: number }): boolean {
  const num = parseInt(accountNumber, 10);
  return num >= range.start && num <= range.end;
}

/**
 * Calculate income statement from vouchers.
 */
export function calculateIncomeStatement(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): IncomeStatement {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Aggregate net amounts per account (credit - debit for P&L)
  // For revenue accounts: credit increases, debit decreases
  // For expense accounts: debit increases (shown as positive expense)
  const balances = new Map<string, number>();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const existing = balances.get(line.accountNumber) ?? 0;
      // Store as credit - debit (natural balance for income statement)
      balances.set(line.accountNumber, existing + line.credit - line.debit);
    }
  }

  // Helper to build section
  function buildSection(
    title: string,
    range: { start: number; end: number },
    invertSign: boolean,
  ): IncomeStatementSection {
    const rows: IncomeStatementRow[] = [];

    for (const [accountNumber, balance] of balances) {
      if (isInRange(accountNumber, range) && balance !== 0) {
        const account = accountMap.get(accountNumber);
        rows.push({
          accountNumber,
          accountName: account?.name ?? "Okänt konto",
          // For expenses, we invert the sign so they appear as positive costs
          amount: invertSign ? -balance : balance,
        });
      }
    }

    // Sort by account number
    rows.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const total = rows.reduce((sum, row) => sum + row.amount, 0);

    return { title, rows, total };
  }

  const revenues = buildSection("Intäkter", REVENUE_RANGE, false);
  const expenses = buildSection("Kostnader", EXPENSE_RANGE, true);
  const operatingResult = revenues.total - expenses.total;

  const financialIncome = buildSection("Finansiella intäkter", FINANCIAL_INCOME_RANGE, false);
  const financialExpenses = buildSection("Finansiella kostnader", FINANCIAL_EXPENSE_RANGE, true);

  const netResult = operatingResult + financialIncome.total - financialExpenses.total;

  return {
    revenues,
    expenses,
    operatingResult,
    financialIncome,
    financialExpenses,
    netResult,
    generatedAt: new Date(),
  };
}
