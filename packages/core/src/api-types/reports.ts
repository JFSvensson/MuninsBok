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

// --- SKV Momsdeklaration (Skattedeklaration moms, SKV 4700) ---

export interface SkVatBoxResponse {
  box: number;
  label: string;
  /** Hela kronor */
  amount: number;
}

export interface SkVatDeclarationResponse {
  /** Ruta 05 – Momspliktig försäljning (exkl. moms). Hela kronor. */
  ruta05: number;
  /** Ruta 06 – Momspliktiga uttag */
  ruta06: number;
  /** Ruta 07 – Beskattningsunderlag vid vinstmarginalbeskattning */
  ruta07: number;
  /** Ruta 08 – Hyresinkomster vid frivillig skattskyldighet */
  ruta08: number;
  /** Ruta 10 – Utgående moms 25 %. Hela kronor. */
  ruta10: number;
  /** Ruta 11 – Utgående moms 12 % */
  ruta11: number;
  /** Ruta 12 – Utgående moms 6 % */
  ruta12: number;
  /** Ruta 20 – Inköp varor EU */
  ruta20: number;
  /** Ruta 21 – Inköp tjänster EU */
  ruta21: number;
  /** Ruta 22 – Inköp varor omvänd skattskyldighet */
  ruta22: number;
  /** Ruta 23 – Inköp tjänster omvänd skattskyldighet */
  ruta23: number;
  /** Ruta 24 – Övriga inköp tjänster utanför EU */
  ruta24: number;
  /** Ruta 30 – Moms varuinköp EU */
  ruta30: number;
  /** Ruta 31 – Moms tjänsteinköp EU */
  ruta31: number;
  /** Ruta 32 – Moms varuinköp omvänd */
  ruta32: number;
  /** Ruta 33 – Moms tjänsteinköp omvänd */
  ruta33: number;
  /** Ruta 35 – Försäljning varor EU */
  ruta35: number;
  /** Ruta 36 – Försäljning varor utanför EU */
  ruta36: number;
  /** Ruta 37 – Mellanman inköp trepartshandel */
  ruta37: number;
  /** Ruta 38 – Mellanman försäljning trepartshandel */
  ruta38: number;
  /** Ruta 39 – Tjänsteförsäljning EU */
  ruta39: number;
  /** Ruta 40 – Övrig momsfri försäljning */
  ruta40: number;
  /** Ruta 41 – Momspliktiga inköp vid import */
  ruta41: number;
  /** Ruta 42 – Beskattningsunderlag vid import */
  ruta42: number;
  /** Ruta 48 – Ingående moms att dra av. Hela kronor. */
  ruta48: number;
  /** Ruta 49 – Moms att betala eller få tillbaka. Hela kronor. */
  ruta49: number;
  /** Ruta 50 – Moms på import */
  ruta50: number;
  /** Non-zero boxes for UI rendering */
  boxes: SkVatBoxResponse[];
  generatedAt: string;
}

// --- Voucher Gaps ---

export interface VoucherGaps {
  gaps: number[];
  count: number;
}

// --- Period Report (Periodrapport) ---

export type PeriodType = "month" | "quarter";

export interface PeriodRowResponse {
  /** Human-readable label, e.g. "2024-01" or "2024 Q1" */
  label: string;
  /** ISO start date of the period (inclusive) */
  startDate: string;
  /** ISO end date of the period (inclusive) */
  endDate: string;
  /** Kronor */
  income: number;
  /** Kronor */
  expenses: number;
  /** Kronor */
  result: number;
  /** Kronor */
  cumulativeResult: number;
}

export interface PeriodReportResponse {
  periodType: PeriodType;
  periods: PeriodRowResponse[];
  /** Kronor */
  totalIncome: number;
  /** Kronor */
  totalExpenses: number;
  /** Kronor */
  totalResult: number;
  generatedAt: string;
}

// --- Closing Preview (Boksluts-förhandsvisning) ---

export interface ClosingEntryLineResponse {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  currentBalance: number;
  /** Kronor */
  closingDebit: number;
  /** Kronor */
  closingCredit: number;
}

export interface ClosingPreviewSectionResponse {
  title: string;
  lines: ClosingEntryLineResponse[];
  /** Kronor */
  total: number;
}

export interface ClosingPreviewResponse {
  revenues: ClosingPreviewSectionResponse;
  expenses: ClosingPreviewSectionResponse;
  financialIncome: ClosingPreviewSectionResponse;
  financialExpenses: ClosingPreviewSectionResponse;
  resultEntry: {
    accountNumber: string;
    accountName: string;
    /** Kronor */
    debit: number;
    /** Kronor */
    credit: number;
  };
  /** Kronor */
  totalRevenues: number;
  /** Kronor */
  totalExpenses: number;
  /** Kronor */
  operatingResult: number;
  /** Kronor */
  totalFinancialIncome: number;
  /** Kronor */
  totalFinancialExpenses: number;
  /** Kronor */
  netResult: number;
  accountCount: number;
  isBalanced: boolean;
  hasEntries: boolean;
  generatedAt: string;
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

// --- Result Disposition (Resultatdisposition) ---

export interface ResultDispositionLineResponse {
  accountNumber: string;
  accountName: string;
  /** Kronor */
  debit: number;
  /** Kronor */
  credit: number;
}

export interface ResultDispositionPreviewResponse {
  closedFiscalYearId: string;
  targetFiscalYearId: string;
  /** Kronor */
  netResult: number;
  lines: ResultDispositionLineResponse[];
  isBalanced: boolean;
  generatedAt: string;
}

// --- Year-End Summary (Sammanställning av årsbokslut) ---

export interface YearEndSummaryResponse {
  fiscalYear: {
    id: string;
    startDate: string;
    endDate: string;
    isClosed: boolean;
  };
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  disposition: ResultDispositionPreviewResponse | null;
  isDisposed: boolean;
  generatedAt: string;
}
