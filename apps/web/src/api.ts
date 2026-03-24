import type {
  Account,
  AccountAnalysis,
  ApiResponse,
  ApprovalRuleEntity,
  ApprovalStepEntity,
  BankConnectionEntity,
  BankSyncRunEntity,
  BankTransactionEntity,
  BankTransactionMatchStatus,
  CustomerEntity,
  InvoiceEntity,
  BalanceSheet,
  Budget,
  BudgetVsActualReport,
  ClosingPreviewResponse,
  CsvImportPreview,
  CsvImportVoucherResult,
  DashboardEnhanced,
  DocumentMeta,
  FiscalYear,
  GeneralLedgerReport,
  IncomeStatement,
  JournalReport,
  MemberRole,
  Organization,
  OrgMember,
  OrgMemberWithUser,
  PaginatedApiResponse,
  PeriodReportResponse,
  ReceiptOcrAnalysis,
  ReceiptOcrStatus,
  ResultDispositionPreviewResponse,
  SearchResponse,
  SkVatDeclarationResponse,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
  VoucherTemplate,
  YearEndSummaryResponse,
} from "@muninsbok/core/api-types";

export type {
  Account,
  AccountAnalysis,
  ApprovalRuleEntity,
  ApprovalStepEntity,
  BankConnectionEntity,
  BankSyncRunEntity,
  BankTransactionEntity,
  BankTransactionMatchStatus,
  CustomerEntity,
  InvoiceEntity,
  InvoiceLineEntity,
  InvoiceStatus,
  BalanceSheet,
  Budget,
  BudgetVsActualReport,
  ClosingPreviewResponse,
  CsvImportPreview,
  CsvImportVoucherResult,
  DashboardEnhanced,
  DashboardSummary,
  DocumentMeta,
  FiscalYear,
  GeneralLedgerReport,
  IncomeStatement,
  JournalReport,
  MemberRole,
  Organization,
  OrgMember,
  OrgMemberWithUser,
  Pagination,
  PeriodReportResponse,
  PeriodRowResponse,
  PeriodType,
  ReceiptOcrAnalysis,
  ReceiptOcrStatus,
  ReportSection,
  ResultDispositionPreviewResponse,
  SearchResponse,
  SkVatDeclarationResponse,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
  VoucherStatus,
  VoucherTemplate,
  YearEndSummaryResponse,
} from "@muninsbok/core/api-types";

const API_BASE = "/api";

// ── Auth types ─────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthResponse {
  data: AuthTokens & { user: AuthUser };
}

export interface RefreshResponse {
  data: AuthTokens;
}

export interface BankSyncConnectionResult {
  syncRunId: string;
  fetched: number;
  created: number;
  updated: number;
  nextCursor?: string;
}

export interface BankRefreshConnectionResult {
  connectionId: string;
  status: "CONNECTED";
  authExpiresAt: string;
}

/**
 * Structured API error with status code and optional error code
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// Lazy-loaded auth-storage to avoid circular imports.
// The module is cheap and only accessed at request time.
async function getAuthStorage() {
  return import("./auth-storage");
}

/**
 * Core auth-aware fetch: injects access token, handles 401 → refresh → retry,
 * and throws ApiError on non-ok responses.
 * All higher-level helpers (fetchJson, fetchVoid) build on this.
 */
async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const storage = await getAuthStorage();
  const accessToken = storage.getAccessToken();

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Auto-inject access token unless caller already set Authorization
  if (accessToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { ...options, headers, credentials: "include" });

  // If 401 and not an auth endpoint, attempt silent refresh via httpOnly cookie
  if (response.status === 401 && !url.includes("/auth/")) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const { data } = (await refreshRes.json()) as RefreshResponse;
        storage.setTokens(data.accessToken);
        headers["Authorization"] = `Bearer ${data.accessToken}`;
        response = await fetch(url, { ...options, headers, credentials: "include" });
      } else {
        // Refresh failed — clear tokens (session expired)
        storage.clearTokens({ notify: true });
      }
    } catch {
      storage.clearTokens({ notify: true });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.code ?? "UNKNOWN",
      errorBody.error?.message ?? errorBody.error ?? "Ett fel uppstod",
    );
  }

  return response;
}

/** JSON request → JSON response (sets Content-Type: application/json). */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
  });
  return response.json();
}

/** JSON request → no response body expected (DELETE, etc.). */
async function fetchVoid(url: string, options?: RequestInit): Promise<void> {
  await fetchWithAuth(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
  });
}

/** Factory for standard report fetchers (org + fiscal year + optional date range). */
function createReportFetcher<T>(endpoint: string) {
  return (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<T>>(
      `${API_BASE}/organizations/${orgId}/reports/${endpoint}?${params}`,
    );
  };
}

export const api = {
  // Organizations
  getDashboard: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<DashboardEnhanced>>(
      `${API_BASE}/organizations/${orgId}/dashboard?fiscalYearId=${fiscalYearId}`,
    ),

  search: (orgId: string, fiscalYearId: string, query: string) =>
    fetchJson<ApiResponse<SearchResponse>>(
      `${API_BASE}/organizations/${orgId}/search?fiscalYearId=${encodeURIComponent(fiscalYearId)}&q=${encodeURIComponent(query)}`,
    ),

  getOrganizations: () => fetchJson<ApiResponse<Organization[]>>(`${API_BASE}/organizations`),

  createOrganization: (data: { orgNumber: string; name: string; fiscalYearStartMonth?: number }) =>
    fetchJson<ApiResponse<Organization>>(`${API_BASE}/organizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrganization: (orgId: string, data: { name?: string; fiscalYearStartMonth?: number }) =>
    fetchJson<ApiResponse<Organization>>(`${API_BASE}/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (orgId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}`, { method: "DELETE" }),

  // Fiscal Years
  getFiscalYears: (orgId: string) =>
    fetchJson<ApiResponse<FiscalYear[]>>(`${API_BASE}/organizations/${orgId}/fiscal-years`),

  createFiscalYear: (orgId: string, data: { startDate: string; endDate: string }) =>
    fetchJson<ApiResponse<FiscalYear>>(`${API_BASE}/organizations/${orgId}/fiscal-years`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeFiscalYear: (orgId: string, fyId: string) =>
    fetchJson<ApiResponse<FiscalYear>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/close`,
      { method: "PATCH" },
    ),

  getClosingPreview: (orgId: string, fyId: string) =>
    fetchJson<ApiResponse<ClosingPreviewResponse>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/close-preview`,
    ),

  // Accounts
  getAccounts: (orgId: string, activeOnly = true) =>
    fetchJson<ApiResponse<Account[]>>(
      `${API_BASE}/organizations/${orgId}/accounts${activeOnly ? "?active=true" : ""}`,
    ),

  getAccount: (orgId: string, accountNumber: string) =>
    fetchJson<ApiResponse<Account>>(`${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`),

  createAccount: (
    orgId: string,
    data: {
      number: string;
      name: string;
      type: Account["type"];
      isVatAccount?: boolean;
    },
  ) =>
    fetchJson<ApiResponse<Account>>(`${API_BASE}/organizations/${orgId}/accounts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivateAccount: (orgId: string, accountNumber: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`, {
      method: "DELETE",
    }),

  // Bank
  getBankConnections: (orgId: string) =>
    fetchJson<ApiResponse<BankConnectionEntity[]>>(
      `${API_BASE}/organizations/${orgId}/bank/connections`,
    ),

  getBankSyncRuns: (orgId: string, connectionId: string, limit = 10) =>
    fetchJson<ApiResponse<BankSyncRunEntity[]>>(
      `${API_BASE}/organizations/${orgId}/bank/${connectionId}/sync-runs?limit=${encodeURIComponent(String(limit))}`,
    ),

  syncBankConnection: (
    orgId: string,
    connectionId: string,
    data?: { fromDate?: string; toDate?: string; pageSize?: number },
  ) =>
    fetchJson<ApiResponse<BankSyncConnectionResult>>(
      `${API_BASE}/organizations/${orgId}/bank/${connectionId}/sync`,
      {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      },
    ),

  refreshBankConnectionAuth: (orgId: string, connectionId: string) =>
    fetchJson<ApiResponse<BankRefreshConnectionResult>>(
      `${API_BASE}/organizations/${orgId}/bank/${connectionId}/auth/refresh`,
      { method: "POST" },
    ),

  getBankTransactions: (
    orgId: string,
    connectionId: string,
    params?: {
      page?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
      matchStatus?: BankTransactionMatchStatus | string;
    },
  ) => {
    const q = new URLSearchParams();
    if (params?.page != null) q.set("page", String(params.page));
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.fromDate) q.set("fromDate", params.fromDate);
    if (params?.toDate) q.set("toDate", params.toDate);
    if (params?.matchStatus) q.set("matchStatus", params.matchStatus);
    const qs = q.toString();
    return fetchJson<{ data: BankTransactionEntity[]; total: number; page: number; limit: number }>(
      `${API_BASE}/organizations/${orgId}/bank/${connectionId}/transactions${qs ? `?${qs}` : ""}`,
    );
  },

  updateAccount: (
    orgId: string,
    accountNumber: string,
    data: {
      name?: string;
      type?: Account["type"];
      isVatAccount?: boolean;
    },
  ) =>
    fetchJson<ApiResponse<Account>>(
      `${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  // Vouchers
  getVouchers: (
    orgId: string,
    fiscalYearId: string,
    options?: { page?: number; limit?: number; search?: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.search) params.set("search", options.search);
    return fetchJson<PaginatedApiResponse<Voucher[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers?${params}`,
    );
  },

  getVoucher: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<Voucher>>(`${API_BASE}/organizations/${orgId}/vouchers/${voucherId}`),

  createVoucher: (
    orgId: string,
    data: {
      fiscalYearId: string;
      date: string;
      description: string;
      lines: { accountNumber: string; debit: number; credit: number; description?: string }[];
      createdBy?: string;
    },
  ) =>
    fetchJson<ApiResponse<Voucher>>(`${API_BASE}/organizations/${orgId}/vouchers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  correctVoucher: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/correct`,
      { method: "POST" },
    ),

  // Reports
  getTrialBalance: createReportFetcher<TrialBalance>("trial-balance"),
  getIncomeStatement: createReportFetcher<IncomeStatement>("income-statement"),
  getBalanceSheet: createReportFetcher<BalanceSheet>("balance-sheet"),
  getVatReport: createReportFetcher<VatReport>("vat"),
  getVatDeclaration: createReportFetcher<SkVatDeclarationResponse>("vat-declaration"),
  getJournal: createReportFetcher<JournalReport>("journal"),
  getGeneralLedger: createReportFetcher<GeneralLedgerReport>("general-ledger"),
  getVoucherListReport: createReportFetcher<VoucherListReportData>("voucher-list"),

  getPeriodReport: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
    periodType: "month" | "quarter" = "month",
  ) => {
    const params = new URLSearchParams({ fiscalYearId, periodType });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<PeriodReportResponse>>(
      `${API_BASE}/organizations/${orgId}/reports/period?${params}`,
    );
  },

  // Voucher gaps
  getVoucherGaps: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<VoucherGaps>>(
      `${API_BASE}/organizations/${orgId}/vouchers/gaps?fiscalYearId=${fiscalYearId}`,
    ),

  // Opening balances
  createOpeningBalances: (orgId: string, fyId: string, previousFiscalYearId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/opening-balances`,
      {
        method: "POST",
        body: JSON.stringify({ previousFiscalYearId }),
      },
    ),

  // Result disposition
  getDispositionPreview: (orgId: string, fyId: string, targetFyId: string) =>
    fetchJson<ApiResponse<ResultDispositionPreviewResponse>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/disposition-preview?targetFyId=${encodeURIComponent(targetFyId)}`,
    ),

  executeDisposition: (orgId: string, targetFyId: string, closedFiscalYearId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${targetFyId}/disposition`,
      {
        method: "POST",
        body: JSON.stringify({ closedFiscalYearId }),
      },
    ),

  // Year-end summary
  getYearEndSummary: (orgId: string, fyId: string, targetFyId?: string) =>
    fetchJson<ApiResponse<YearEndSummaryResponse>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/year-end-summary${targetFyId ? `?targetFyId=${encodeURIComponent(targetFyId)}` : ""}`,
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
      },
    ),

  // Documents
  getVoucherDocuments: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<DocumentMeta[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/documents`,
    ),

  uploadDocument: async (orgId: string, voucherId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    // fetchWithAuth handles auth + refresh; no Content-Type so the browser
    // sets the correct multipart boundary automatically.
    const response = await fetchWithAuth(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/documents`,
      { method: "POST", body: formData },
    );
    return response.json() as Promise<ApiResponse<DocumentMeta>>;
  },

  analyzeReceipt: async (orgId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetchWithAuth(`${API_BASE}/organizations/${orgId}/receipt-ocr/analyze`, {
      method: "POST",
      body: formData,
    });
    return response.json() as Promise<ApiResponse<ReceiptOcrAnalysis>>;
  },

  getReceiptOcrStatus: (orgId: string) =>
    fetchJson<ApiResponse<ReceiptOcrStatus>>(
      `${API_BASE}/organizations/${orgId}/receipt-ocr/status`,
    ),

  analyzeUploadedDocumentReceipt: (orgId: string, documentId: string) =>
    fetchJson<ApiResponse<ReceiptOcrAnalysis>>(
      `${API_BASE}/organizations/${orgId}/documents/${documentId}/receipt-ocr`,
      {
        method: "POST",
      },
    ),

  downloadDocumentUrl: (orgId: string, documentId: string) =>
    `${API_BASE}/organizations/${orgId}/documents/${documentId}/download`,

  deleteDocument: (orgId: string, documentId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/documents/${documentId}`, {
      method: "DELETE",
    }),

  // ── Auth ──────────────────────────────────────────────────

  login: (email: string, password: string) =>
    fetchJson<AuthResponse>(`${API_BASE}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, name: string, password: string) =>
    fetchJson<AuthResponse>(`${API_BASE}/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),

  refreshTokens: () =>
    fetchJson<RefreshResponse>(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    }),

  getMe: (accessToken: string) =>
    fetchJson<ApiResponse<AuthUser>>(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  logout: () => fetchVoid(`${API_BASE}/auth/logout`, { method: "POST" }),

  // ── Members ───────────────────────────────────────────────

  getMembers: (orgId: string) =>
    fetchJson<ApiResponse<OrgMemberWithUser[]>>(`${API_BASE}/organizations/${orgId}/members`),

  addMember: (orgId: string, email: string, role: MemberRole = "MEMBER") =>
    fetchJson<ApiResponse<OrgMember>>(`${API_BASE}/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  updateMemberRole: (orgId: string, userId: string, role: MemberRole) =>
    fetchJson<ApiResponse<OrgMember>>(`${API_BASE}/organizations/${orgId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  removeMember: (orgId: string, userId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),

  // ── Voucher Templates ─────────────────────────────────────

  getVoucherTemplates: (orgId: string) =>
    fetchJson<ApiResponse<VoucherTemplate[]>>(`${API_BASE}/organizations/${orgId}/templates`),

  getVoucherTemplate: (orgId: string, templateId: string) =>
    fetchJson<ApiResponse<VoucherTemplate>>(
      `${API_BASE}/organizations/${orgId}/templates/${templateId}`,
    ),

  createVoucherTemplate: (
    orgId: string,
    data: {
      name: string;
      description?: string;
      lines: { accountNumber: string; debit: number; credit: number; description?: string }[];
    },
  ) =>
    fetchJson<ApiResponse<VoucherTemplate>>(`${API_BASE}/organizations/${orgId}/templates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateVoucherTemplate: (
    orgId: string,
    templateId: string,
    data: {
      name?: string;
      description?: string | null;
      lines?: { accountNumber: string; debit: number; credit: number; description?: string }[];
    },
  ) =>
    fetchJson<ApiResponse<VoucherTemplate>>(
      `${API_BASE}/organizations/${orgId}/templates/${templateId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  deleteVoucherTemplate: (orgId: string, templateId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/templates/${templateId}`, {
      method: "DELETE",
    }),

  updateRecurringSchedule: (
    orgId: string,
    templateId: string,
    data: {
      isRecurring: boolean;
      frequency?: "MONTHLY" | "QUARTERLY";
      dayOfMonth?: number;
      nextRunDate?: string;
      recurringEndDate?: string | null;
    },
  ) =>
    fetchJson<ApiResponse<VoucherTemplate>>(
      `${API_BASE}/organizations/${orgId}/templates/${templateId}/recurring`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  getDueRecurringTemplates: (orgId: string) =>
    fetchJson<ApiResponse<VoucherTemplate[]>>(
      `${API_BASE}/organizations/${orgId}/templates/recurring/due`,
    ),

  executeRecurringTemplates: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<{ vouchersCreated: number; errors: string[] }>>(
      `${API_BASE}/organizations/${orgId}/templates/recurring/execute`,
      { method: "POST", body: JSON.stringify({ fiscalYearId }) },
    ),

  // ── Budgets ───────────────────────────────────────────────

  getBudgets: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<Budget[]>>(
      `${API_BASE}/organizations/${orgId}/budgets?fiscalYearId=${encodeURIComponent(fiscalYearId)}`,
    ),

  getBudget: (orgId: string, budgetId: string) =>
    fetchJson<ApiResponse<Budget>>(`${API_BASE}/organizations/${orgId}/budgets/${budgetId}`),

  createBudget: (
    orgId: string,
    data: {
      fiscalYearId: string;
      name: string;
      entries: { accountNumber: string; month: number; amount: number }[];
    },
  ) =>
    fetchJson<ApiResponse<Budget>>(`${API_BASE}/organizations/${orgId}/budgets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBudget: (
    orgId: string,
    budgetId: string,
    data: {
      name?: string;
      entries?: { accountNumber: string; month: number; amount: number }[];
    },
  ) =>
    fetchJson<ApiResponse<Budget>>(`${API_BASE}/organizations/${orgId}/budgets/${budgetId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteBudget: (orgId: string, budgetId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/budgets/${budgetId}`, {
      method: "DELETE",
    }),

  getBudgetVsActual: (
    orgId: string,
    budgetId: string,
    params?: { startDate?: string; endDate?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("startDate", params.startDate);
    if (params?.endDate) qs.set("endDate", params.endDate);
    const query = qs.toString();
    return fetchJson<ApiResponse<BudgetVsActualReport>>(
      `${API_BASE}/organizations/${orgId}/budgets/${budgetId}/vs-actual${query ? `?${query}` : ""}`,
    );
  },

  // ── Account Analysis ──────────────────────────────────────

  getAccountAnalysis: (
    orgId: string,
    fiscalYearId: string,
    accountNumber: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId, accountNumber });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<AccountAnalysis>>(
      `${API_BASE}/organizations/${orgId}/reports/account-analysis?${params}`,
    );
  },

  // ── CSV Import ────────────────────────────────────────────

  parseCsv: (orgId: string, csv: string) =>
    fetchJson<ApiResponse<{ headers: string[]; sampleRows: string[][]; totalRows: number }>>(
      `${API_BASE}/organizations/${orgId}/import/csv/parse`,
      { method: "POST", body: JSON.stringify({ csv }) },
    ),

  previewCsvImport: (
    orgId: string,
    csv: string,
    mapping: { dateColumn: number; descriptionColumn: number; amountColumn: number },
  ) =>
    fetchJson<ApiResponse<CsvImportPreview>>(
      `${API_BASE}/organizations/${orgId}/import/csv/preview`,
      { method: "POST", body: JSON.stringify({ csv, mapping }) },
    ),

  executeCsvImport: (
    orgId: string,
    data: {
      fiscalYearId: string;
      bankAccountNumber: string;
      defaultAccountNumber: string;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        accountNumber?: string;
      }>;
    },
  ) =>
    fetchJson<ApiResponse<CsvImportVoucherResult>>(
      `${API_BASE}/organizations/${orgId}/import/csv/execute`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  // ── Approval ──────────────────────────────────────────────

  getApprovalRules: (orgId: string) =>
    fetchJson<ApiResponse<ApprovalRuleEntity[]>>(
      `${API_BASE}/organizations/${orgId}/approval-rules`,
    ),

  createApprovalRule: (
    orgId: string,
    data: {
      name: string;
      minAmount: number;
      maxAmount?: number | null;
      requiredRole: string;
      stepOrder: number;
    },
  ) =>
    fetchJson<ApiResponse<ApprovalRuleEntity>>(
      `${API_BASE}/organizations/${orgId}/approval-rules`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  updateApprovalRule: (
    orgId: string,
    ruleId: string,
    data: {
      name?: string;
      minAmount?: number;
      maxAmount?: number | null;
      requiredRole?: string;
      stepOrder?: number;
    },
  ) =>
    fetchJson<ApiResponse<ApprovalRuleEntity>>(
      `${API_BASE}/organizations/${orgId}/approval-rules/${ruleId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  deleteApprovalRule: (orgId: string, ruleId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/approval-rules/${ruleId}`, {
      method: "DELETE",
    }),

  submitVoucherForApproval: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/submit`,
      { method: "POST" },
    ),

  decideApprovalStep: (
    orgId: string,
    voucherId: string,
    stepId: string,
    data: { decision: "APPROVED" | "REJECTED"; comment?: string },
  ) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/approval-steps/${stepId}/decide`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  getPendingApprovals: (orgId: string) =>
    fetchJson<ApiResponse<ApprovalStepEntity[]>>(
      `${API_BASE}/organizations/${orgId}/approval-steps/pending`,
    ),

  getVoucherApprovalSteps: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<ApprovalStepEntity[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/approval-steps`,
    ),

  // ── Customers ─────────────────────────────────────────────

  getCustomers: (orgId: string) =>
    fetchJson<ApiResponse<CustomerEntity[]>>(`${API_BASE}/organizations/${orgId}/customers`),

  getCustomer: (orgId: string, customerId: string) =>
    fetchJson<ApiResponse<CustomerEntity>>(
      `${API_BASE}/organizations/${orgId}/customers/${customerId}`,
    ),

  createCustomer: (orgId: string, data: Record<string, unknown>) =>
    fetchJson<ApiResponse<CustomerEntity>>(`${API_BASE}/organizations/${orgId}/customers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCustomer: (orgId: string, customerId: string, data: Record<string, unknown>) =>
    fetchJson<ApiResponse<CustomerEntity>>(
      `${API_BASE}/organizations/${orgId}/customers/${customerId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  deleteCustomer: (orgId: string, customerId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/customers/${customerId}`, {
      method: "DELETE",
    }),

  // ── Invoices ──────────────────────────────────────────────

  getInvoices: (orgId: string, status?: string) =>
    fetchJson<ApiResponse<InvoiceEntity[]>>(
      `${API_BASE}/organizations/${orgId}/invoices${status ? `?status=${status}` : ""}`,
    ),

  getInvoice: (orgId: string, invoiceId: string) =>
    fetchJson<ApiResponse<InvoiceEntity>>(
      `${API_BASE}/organizations/${orgId}/invoices/${invoiceId}`,
    ),

  getCustomerInvoices: (orgId: string, customerId: string) =>
    fetchJson<ApiResponse<InvoiceEntity[]>>(
      `${API_BASE}/organizations/${orgId}/customers/${customerId}/invoices`,
    ),

  createInvoice: (
    orgId: string,
    data: {
      customerId: string;
      issueDate: string;
      dueDate: string;
      ourReference?: string;
      yourReference?: string;
      notes?: string;
      lines: {
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        accountNumber?: string;
      }[];
    },
  ) =>
    fetchJson<ApiResponse<InvoiceEntity>>(`${API_BASE}/organizations/${orgId}/invoices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateInvoice: (orgId: string, invoiceId: string, data: Record<string, unknown>) =>
    fetchJson<ApiResponse<InvoiceEntity>>(
      `${API_BASE}/organizations/${orgId}/invoices/${invoiceId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  updateInvoiceStatus: (
    orgId: string,
    invoiceId: string,
    data: { status: string; paidDate?: string },
  ) =>
    fetchJson<ApiResponse<InvoiceEntity>>(
      `${API_BASE}/organizations/${orgId}/invoices/${invoiceId}/status`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  deleteInvoice: (orgId: string, invoiceId: string) =>
    fetchVoid(`${API_BASE}/organizations/${orgId}/invoices/${invoiceId}`, {
      method: "DELETE",
    }),
};
