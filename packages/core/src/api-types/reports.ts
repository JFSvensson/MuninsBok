/**
 * API contract types for report endpoints.
 *
 * All monetary amounts are in kronor (SEK) — the API divides domain öre
 * values by 100 before responding.  Dates are ISO 8601 strings.
 */

// --- Trial Balance (Råbalans) ---

export interface TrialBalanceRow {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  debit: number;
  /** Kronor */
  credit: number;
  /** Kronor */
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
  generatedAt: string;
}

// --- Shared report section used by IncomeStatement & BalanceSheet ---

export interface ReportSection {
  title: string;
  rows: { accountNumber: string; accountName: string; amount: number }[];
  /** Kronor */
  total: number;
}

// --- Income Statement (Resultaträkning) ---

export interface IncomeStatement {
  revenues: ReportSection;
  expenses: ReportSection;
  /** Kronor */
  operatingResult: number;
  financialIncome: ReportSection;
  financialExpenses: ReportSection;
  /** Kronor */
  netResult: number;
  generatedAt: string;
}

// --- Balance Sheet (Balansräkning) ---

export interface BalanceSheet {
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  /** Kronor */
  totalAssets: number;
  /** Kronor */
  totalLiabilitiesAndEquity: number;
  /** Kronor */
  difference: number;
  /** Kronor */
  yearResult: number;
  generatedAt: string;
}

// --- VAT Report (Momsrapport) ---

export interface VatReportRow {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  amount: number;
}

export interface VatReport {
  outputVat: VatReportRow[];
  /** Kronor */
  totalOutputVat: number;
  inputVat: VatReportRow[];
  /** Kronor */
  totalInputVat: number;
  /** Kronor */
  vatPayable: number;
  generatedAt: string;
}

// --- Journal (Grundbok) ---

export interface JournalLine {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  debit: number;
  /** Kronor */
  credit: number;
  description?: string;
}

export interface JournalEntry {
  voucherId: string;
  voucherNumber: number;
  date: string;
  description: string;
  lines: JournalLine[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
}

export interface JournalReport {
  entries: JournalEntry[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
  generatedAt: string;
}

// --- General Ledger (Huvudbok) ---

export interface GeneralLedgerTransaction {
  voucherId: string;
  voucherNumber: number;
  date: string;
  description: string;
  /** Kronor */
  debit: number;
  /** Kronor */
  credit: number;
  /** Kronor */
  balance: number;
}

export interface GeneralLedgerAccount {
  accountNumber: string;
  accountName: string;
  transactions: GeneralLedgerTransaction[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
  /** Kronor */
  closingBalance: number;
}

export interface GeneralLedgerReport {
  accounts: GeneralLedgerAccount[];
  generatedAt: string;
}

// --- Voucher List Report (Verifikationslista) ---

export interface VoucherListReportLine {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  debit: number;
  /** Kronor */
  credit: number;
  description?: string;
}

export interface VoucherListReportEntry {
  voucherId: string;
  voucherNumber: number;
  date: string;
  description: string;
  createdBy?: string;
  lines: VoucherListReportLine[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
}

export interface VoucherListReportData {
  entries: VoucherListReportEntry[];
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
  count: number;
  generatedAt: string;
}

// --- Voucher Gaps ---

export interface VoucherGaps {
  gaps: number[];
  count: number;
}

// --- Dashboard ---

export interface DashboardSummary {
  voucherCount: number;
  accountCount: number;
  /** Kronor */
  netResult: number;
  /** Kronor */
  totalDebit: number;
  /** Kronor */
  totalCredit: number;
  isBalanced: boolean;
  latestVouchers: {
    id: string;
    number: number;
    date: string;
    description: string;
    /** Kronor */
    amount: number;
  }[];
  accountTypeCounts: Record<string, number>;
  monthlyTrend: {
    month: string;
    voucherCount: number;
    /** Kronor */
    income: number;
    /** Kronor */
    expense: number;
  }[];
  generatedAt: string;
}
