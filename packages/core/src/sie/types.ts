/**
 * SIE (Standard Import Export) types.
 * SIE4 is the most comprehensive format, including transactions.
 *
 * @see https://sie.se/format/
 */

export interface SieFile {
  /** #FLAGGA - 0 = not flagged */
  readonly flag: number;
  /** #FORMAT - PC8 for SIE4 */
  readonly format: string;
  /** #SIETYP - 4 for SIE4 */
  readonly sieType: number;
  /** #PROGRAM - generating program name and version */
  readonly program: SieProgram;
  /** #GEN - generation date and signature */
  readonly generated: SieGeneration;
  /** #FNAMN - company/organization name */
  readonly companyName: string;
  /** #ORGNR - organization number */
  readonly orgNumber?: string;
  /** #RAR - fiscal years */
  readonly fiscalYears: readonly SieFiscalYear[];
  /** #KONTO - accounts */
  readonly accounts: readonly SieAccount[];
  /** #IB - opening balances */
  readonly openingBalances: readonly SieBalance[];
  /** #UB - closing balances */
  readonly closingBalances: readonly SieBalance[];
  /** #RES - result accounts */
  readonly resultBalances: readonly SieBalance[];
  /** #VER - vouchers */
  readonly vouchers: readonly SieVoucher[];
}

export interface SieProgram {
  readonly name: string;
  readonly version: string;
}

export interface SieGeneration {
  readonly date: Date;
  readonly signature?: string;
}

export interface SieFiscalYear {
  /** Year index: 0 = current, -1 = previous */
  readonly index: number;
  readonly startDate: Date;
  readonly endDate: Date;
}

export interface SieAccount {
  readonly number: string;
  readonly name: string;
}

export interface SieBalance {
  /** Year index: 0 = current, -1 = previous */
  readonly yearIndex: number;
  readonly accountNumber: string;
  /** Positive = debit balance, negative = credit balance */
  readonly balance: number;
}

export interface SieVoucher {
  /** Voucher series (A, B, etc.) */
  readonly series: string;
  /** Voucher number */
  readonly number: number;
  readonly date: Date;
  readonly description: string;
  readonly transactions: readonly SieTransaction[];
}

export interface SieTransaction {
  readonly accountNumber: string;
  /** Positive = debit, negative = credit */
  readonly amount: number;
  readonly date?: Date;
  readonly description?: string;
}

export interface SieParseError {
  readonly code:
    | "INVALID_FORMAT"
    | "MISSING_REQUIRED_FIELD"
    | "INVALID_DATE"
    | "INVALID_NUMBER"
    | "UNBALANCED_VOUCHER";
  readonly message: string;
  readonly line?: number;
  readonly field?: string;
}

export interface SieExportOptions {
  readonly companyName: string;
  readonly orgNumber?: string;
  readonly programName?: string;
  readonly programVersion?: string;
}

/**
 * Default empty SIE file structure
 */
export function createEmptySieFile(options: SieExportOptions): SieFile {
  return {
    flag: 0,
    format: "PC8",
    sieType: 4,
    program: {
      name: options.programName ?? "Munins bok",
      version: options.programVersion ?? "0.1.0",
    },
    generated: {
      date: new Date(),
    },
    companyName: options.companyName,
    ...(options.orgNumber !== undefined && { orgNumber: options.orgNumber }),
    fiscalYears: [],
    accounts: [],
    openingBalances: [],
    closingBalances: [],
    resultBalances: [],
    vouchers: [],
  };
}
