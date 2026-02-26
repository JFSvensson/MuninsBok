import type {
  Account,
  ApiResponse,
  BalanceSheet,
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
  PaginatedApiResponse,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
} from "@muninsbok/core/api-types";

export type {
  Account,
  BalanceSheet,
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
  ReportSection,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
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
  refreshToken: string;
}

export interface AuthResponse {
  data: AuthTokens & { user: AuthUser };
}

export interface RefreshResponse {
  data: AuthTokens;
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

  let response = await fetch(url, { ...options, headers });

  // If 401 and we have a refresh token, attempt silent refresh then retry once
  if (response.status === 401 && !url.includes("/auth/")) {
    const refreshToken = storage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshToken}`,
          },
        });
        if (refreshRes.ok) {
          const { data } = (await refreshRes.json()) as RefreshResponse;
          storage.setTokens(data.accessToken, data.refreshToken);
          headers["Authorization"] = `Bearer ${data.accessToken}`;
          response = await fetch(url, { ...options, headers });
        } else {
          // Refresh failed — clear tokens (session expired)
          storage.clearTokens({ notify: true });
        }
      } catch {
        storage.clearTokens({ notify: true });
      }
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

export const api = {
  // Organizations
  getDashboard: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<DashboardSummary>>(
      `${API_BASE}/organizations/${orgId}/dashboard?fiscalYearId=${fiscalYearId}`,
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
  getTrialBalance: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<TrialBalance>>(
      `${API_BASE}/organizations/${orgId}/reports/trial-balance?${params}`,
    );
  },

  getIncomeStatement: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<IncomeStatement>>(
      `${API_BASE}/organizations/${orgId}/reports/income-statement?${params}`,
    );
  },

  getBalanceSheet: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<BalanceSheet>>(
      `${API_BASE}/organizations/${orgId}/reports/balance-sheet?${params}`,
    );
  },

  getVatReport: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<VatReport>>(
      `${API_BASE}/organizations/${orgId}/reports/vat?${params}`,
    );
  },

  getJournal: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<JournalReport>>(
      `${API_BASE}/organizations/${orgId}/reports/journal?${params}`,
    );
  },

  getGeneralLedger: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<GeneralLedgerReport>>(
      `${API_BASE}/organizations/${orgId}/reports/general-ledger?${params}`,
    );
  },

  getVoucherListReport: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<VoucherListReportData>>(
      `${API_BASE}/organizations/${orgId}/reports/voucher-list?${params}`,
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

  refreshTokens: (refreshToken: string) =>
    fetchJson<RefreshResponse>(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    }),

  getMe: (accessToken: string) =>
    fetchJson<ApiResponse<AuthUser>>(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

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
};
