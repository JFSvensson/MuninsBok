import type { SieExportOptions, SieVoucher, SieAccount, SieFiscalYear } from "./types.js";
import type { Voucher } from "../types/voucher.js";
import type { Account } from "../types/account.js";
import type { FiscalYear } from "../types/fiscal-year.js";

/**
 * Export data to SIE4 format string.
 */
export function exportSie(
  options: SieExportOptions & {
    fiscalYear: FiscalYear;
    accounts: readonly Account[];
    vouchers: readonly Voucher[];
    openingBalances?: Map<string, number>;
    closingBalances?: Map<string, number>;
    resultBalances?: Map<string, number>;
  },
): string {
  const lines: string[] = [];

  // Header
  lines.push("#FLAGGA 0");
  lines.push("#FORMAT PC8");
  lines.push("#SIETYP 4");
  lines.push(
    `#PROGRAM "${options.programName ?? "Munins bok"}" "${options.programVersion ?? "0.1.0"}"`,
  );
  lines.push(`#GEN ${formatSieDate(new Date())}`);
  lines.push(`#FNAMN "${escapeString(options.companyName)}"`);

  if (options.orgNumber) {
    lines.push(`#ORGNR ${options.orgNumber}`);
  }

  // Fiscal year
  lines.push(
    `#RAR 0 ${formatSieDate(options.fiscalYear.startDate)} ${formatSieDate(options.fiscalYear.endDate)}`,
  );

  // Accounts
  for (const account of options.accounts) {
    lines.push(`#KONTO ${account.number} "${escapeString(account.name)}"`);
  }

  // Opening balances (if provided)
  if (options.openingBalances) {
    for (const [accountNumber, balance] of options.openingBalances) {
      if (balance !== 0) {
        lines.push(`#IB 0 ${accountNumber} ${formatAmount(balance)}`);
      }
    }
  }

  // Closing balances (if provided) – balance sheet accounts
  if (options.closingBalances) {
    for (const [accountNumber, balance] of options.closingBalances) {
      if (balance !== 0) {
        lines.push(`#UB 0 ${accountNumber} ${formatAmount(balance)}`);
      }
    }
  }

  // Result balances (if provided) – P&L accounts
  if (options.resultBalances) {
    for (const [accountNumber, balance] of options.resultBalances) {
      if (balance !== 0) {
        lines.push(`#RES 0 ${accountNumber} ${formatAmount(balance)}`);
      }
    }
  }

  // Vouchers
  for (const voucher of options.vouchers) {
    const series = "A"; // Default series
    lines.push(
      `#VER "${series}" ${voucher.number} ${formatSieDate(voucher.date)} "${escapeString(voucher.description)}"`,
    );
    lines.push("{");

    for (const line of voucher.lines) {
      // SIE uses positive for debit, negative for credit
      const amount = line.debit > 0 ? line.debit : -line.credit;
      lines.push(
        `#TRANS ${line.accountNumber} {} ${formatAmount(amount)}${line.description ? ` "${escapeString(line.description)}"` : ""}`,
      );
    }

    lines.push("}");
  }

  return lines.join("\n");
}

/**
 * Convert domain vouchers to SIE vouchers.
 */
export function toSieVouchers(vouchers: readonly Voucher[]): SieVoucher[] {
  return vouchers.map((v) => ({
    series: "A",
    number: v.number,
    date: v.date,
    description: v.description,
    transactions: v.lines.map((line) => ({
      accountNumber: line.accountNumber,
      amount: line.debit > 0 ? line.debit : -line.credit,
      ...(line.description !== undefined && { description: line.description }),
    })),
  }));
}

/**
 * Convert domain accounts to SIE accounts.
 */
export function toSieAccounts(accounts: readonly Account[]): SieAccount[] {
  return accounts.map((a) => ({
    number: a.number,
    name: a.name,
  }));
}

/**
 * Convert domain fiscal year to SIE fiscal year.
 */
export function toSieFiscalYear(fy: FiscalYear, index: number = 0): SieFiscalYear {
  return {
    index,
    startDate: fy.startDate,
    endDate: fy.endDate,
  };
}

/**
 * Format a Date to SIE date format (YYYYMMDD).
 */
function formatSieDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Format an amount (in ören) for SIE.
 */
function formatAmount(amountInOren: number): string {
  const kronor = amountInOren / 100;
  // SIE uses comma as decimal separator
  return kronor.toFixed(2).replace(".", ",");
}

/**
 * Escape a string for SIE format.
 */
function escapeString(str: string): string {
  return str.replace(/"/g, '""');
}
