const API_BASE = "/api";

export interface Organization {
  id: string;
  orgNumber: string;
  name: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalYear {
  id: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  number: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  isVatAccount: boolean;
  isActive: boolean;
}

export interface VoucherLine {
  id: string;
  voucherId: string;
  accountNumber: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface Voucher {
  id: string;
  fiscalYearId: string;
  organizationId: string;
  number: number;
  date: string;
  description: string;
  lines: VoucherLine[];
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TrialBalanceRow {
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  generatedAt: string;
}

export interface ReportSection {
  title: string;
  rows: { accountNumber: string; accountName: string; amount: number }[];
  total: number;
}

export interface IncomeStatement {
  revenues: ReportSection;
  expenses: ReportSection;
  operatingResult: number;
  financialIncome: ReportSection;
  financialExpenses: ReportSection;
  netResult: number;
  generatedAt: string;
}

export interface BalanceSheet {
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  yearResult: number;
  generatedAt: string;
}

interface ApiResponse<T> {
  data: T;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error?.message ?? error.error ?? "Request failed");
  }

  return response.json();
}

export const api = {
  // Organizations
  getOrganizations: () =>
    fetchJson<ApiResponse<Organization[]>>(`${API_BASE}/organizations`),

  createOrganization: (data: {
    orgNumber: string;
    name: string;
    fiscalYearStartMonth?: number;
  }) =>
    fetchJson<ApiResponse<Organization>>(`${API_BASE}/organizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Fiscal Years
  getFiscalYears: (orgId: string) =>
    fetchJson<ApiResponse<FiscalYear[]>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years`
    ),

  createFiscalYear: (orgId: string, data: { startDate: string; endDate: string }) =>
    fetchJson<ApiResponse<FiscalYear>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  // Accounts
  getAccounts: (orgId: string) =>
    fetchJson<ApiResponse<Account[]>>(
      `${API_BASE}/organizations/${orgId}/accounts?active=true`
    ),

  // Vouchers
  getVouchers: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<Voucher[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers?fiscalYearId=${fiscalYearId}`
    ),

  createVoucher: (
    orgId: string,
    data: {
      fiscalYearId: string;
      date: string;
      description: string;
      lines: { accountNumber: string; debit: number; credit: number; description?: string }[];
    }
  ) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/vouchers`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  // Reports
  getTrialBalance: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<TrialBalance>>(
      `${API_BASE}/organizations/${orgId}/reports/trial-balance?fiscalYearId=${fiscalYearId}`
    ),

  getIncomeStatement: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<IncomeStatement>>(
      `${API_BASE}/organizations/${orgId}/reports/income-statement?fiscalYearId=${fiscalYearId}`
    ),

  getBalanceSheet: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<BalanceSheet>>(
      `${API_BASE}/organizations/${orgId}/reports/balance-sheet?fiscalYearId=${fiscalYearId}`
    ),

  // SIE
  exportSie: (orgId: string, fiscalYearId: string) =>
    `${API_BASE}/organizations/${orgId}/sie/export?fiscalYearId=${fiscalYearId}`,

  importSie: async (orgId: string, fiscalYearId: string, content: string) =>
    fetchJson<ApiResponse<{ vouchersImported: number; accountsImported: number }>>(
      `${API_BASE}/organizations/${orgId}/sie/import?fiscalYearId=${fiscalYearId}`,
      {
        method: "POST",
        body: content,
        headers: { "Content-Type": "text/plain" },
      }
    ),
};
