import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * VAT Report (Momsrapport / Skattedeklaration moms)
 *
 * Aggregates Swedish VAT accounts from BAS 2024 simplified:
 *  - 2610 Utgående moms 25%
 *  - 2620 Utgående moms 12%
 *  - 2630 Utgående moms 6%
 *  - 2640 Ingående moms
 *  - 2650 Redovisningskonto moms
 *  - 1650 Momsfordran
 *
 * All amounts in ören.
 */

export interface VatReportRow {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly amount: number; // credit balance in ören (positive = moms att betala)
}

export interface VatReport {
  /** Utgående moms per rate */
  readonly outputVat: readonly VatReportRow[];
  /** Total utgående moms */
  readonly totalOutputVat: number;
  /** Ingående moms (avdragsgill) */
  readonly inputVat: readonly VatReportRow[];
  /** Total ingående moms */
  readonly totalInputVat: number;
  /** Moms att betala (positive) eller fordran (negative) */
  readonly vatPayable: number;
  readonly generatedAt: Date;
}

/** Accounts for output VAT (utgående moms) */
const OUTPUT_VAT_ACCOUNTS = ["2610", "2620", "2630"];

/** Accounts for input VAT (ingående moms) */
const INPUT_VAT_ACCOUNTS = ["2640"];

/**
 * Calculate VAT report from vouchers and accounts.
 *
 * Output VAT (2610-2630) has a natural credit balance → positive = moms att betala.
 * Input VAT (2640) has a natural debit balance → we show as positive (avdragsgill moms).
 */
export function calculateVatReport(
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
): VatReport {
  const accountMap = new Map(accounts.map((a) => [a.number, a]));

  // Aggregate credit - debit per account
  const balances = new Map<string, number>();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const existing = balances.get(line.accountNumber) ?? 0;
      balances.set(line.accountNumber, existing + line.credit - line.debit);
    }
  }

  // Build output VAT rows
  const outputVat: VatReportRow[] = [];
  for (const accNum of OUTPUT_VAT_ACCOUNTS) {
    const balance = balances.get(accNum);
    if (balance != null && balance !== 0) {
      const account = accountMap.get(accNum);
      outputVat.push({
        accountNumber: accNum,
        accountName: account?.name ?? "Okänt konto",
        amount: balance, // credit balance is positive
      });
    }
  }
  outputVat.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  const totalOutputVat = outputVat.reduce((sum, r) => sum + r.amount, 0);

  // Build input VAT rows (debit balance → negate to show positive)
  const inputVat: VatReportRow[] = [];
  for (const accNum of INPUT_VAT_ACCOUNTS) {
    const balance = balances.get(accNum);
    if (balance != null && balance !== 0) {
      const account = accountMap.get(accNum);
      inputVat.push({
        accountNumber: accNum,
        accountName: account?.name ?? "Okänt konto",
        amount: -balance, // debit balance stored negative, show positive
      });
    }
  }
  inputVat.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  const totalInputVat = inputVat.reduce((sum, r) => sum + r.amount, 0);

  // Moms att betala = utgående - ingående
  // Positive → skuld till Skatteverket, Negative → fordran
  const vatPayable = totalOutputVat - totalInputVat;

  return {
    outputVat,
    totalOutputVat,
    inputVat,
    totalInputVat,
    vatPayable,
    generatedAt: new Date(),
  };
}
