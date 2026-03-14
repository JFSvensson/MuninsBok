import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LocaleProvider, useLocale } from "./context/LocaleContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import styles from "./App.module.css";
import { OrganizationSelect } from "./components/OrganizationSelect";
import { ThemeToggle } from "./components/ThemeToggle";
import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { CreateOrganizationDialog } from "./components/CreateOrganizationDialog";
import { SearchDialog } from "./components/SearchDialog";

// Lazy-loaded page components (code-split per route)
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const VoucherList = lazy(() =>
  import("./pages/VoucherList").then((m) => ({ default: m.VoucherList })),
);
const VoucherCreate = lazy(() =>
  import("./pages/VoucherCreate").then((m) => ({ default: m.VoucherCreate })),
);
const VoucherDetail = lazy(() =>
  import("./pages/VoucherDetail").then((m) => ({ default: m.VoucherDetail })),
);
const AccountList = lazy(() =>
  import("./pages/AccountList").then((m) => ({ default: m.AccountList })),
);
const TrialBalance = lazy(() =>
  import("./pages/TrialBalance").then((m) => ({ default: m.TrialBalance })),
);
const IncomeStatement = lazy(() =>
  import("./pages/IncomeStatement").then((m) => ({ default: m.IncomeStatement })),
);
const BalanceSheet = lazy(() =>
  import("./pages/BalanceSheet").then((m) => ({ default: m.BalanceSheet })),
);
const VatReport = lazy(() => import("./pages/VatReport").then((m) => ({ default: m.VatReport })));
const VatDeclaration = lazy(() =>
  import("./pages/VatDeclaration").then((m) => ({ default: m.VatDeclaration })),
);
const PeriodReport = lazy(() =>
  import("./pages/PeriodReport").then((m) => ({ default: m.PeriodReport })),
);
const Journal = lazy(() => import("./pages/Journal").then((m) => ({ default: m.Journal })));
const GeneralLedger = lazy(() =>
  import("./pages/GeneralLedger").then((m) => ({ default: m.GeneralLedger })),
);
const VoucherListReport = lazy(() =>
  import("./pages/VoucherListReport").then((m) => ({ default: m.VoucherListReport })),
);
const SieExport = lazy(() => import("./pages/SieExport").then((m) => ({ default: m.SieExport })));
const CsvImport = lazy(() => import("./pages/CsvImport").then((m) => ({ default: m.CsvImport })));
const FiscalYears = lazy(() =>
  import("./pages/FiscalYears").then((m) => ({ default: m.FiscalYears })),
);
const YearEndClosing = lazy(() => import("./pages/YearEndClosing"));
const ResultDisposition = lazy(() =>
  import("./pages/ResultDisposition").then((m) => ({ default: m.ResultDisposition })),
);
const YearEndSummary = lazy(() =>
  import("./pages/YearEndSummary").then((m) => ({ default: m.YearEndSummary })),
);
const VoucherTemplates = lazy(() =>
  import("./pages/VoucherTemplates").then((m) => ({ default: m.VoucherTemplates })),
);
const VoucherTemplateForm = lazy(() =>
  import("./pages/VoucherTemplateForm").then((m) => ({ default: m.VoucherTemplateForm })),
);
const Budgets = lazy(() => import("./pages/Budgets").then((m) => ({ default: m.Budgets })));
const BudgetForm = lazy(() =>
  import("./pages/BudgetForm").then((m) => ({ default: m.BudgetForm })),
);
const BudgetVsActual = lazy(() =>
  import("./pages/BudgetVsActual").then((m) => ({ default: m.BudgetVsActual })),
);
const AccountAnalysis = lazy(() =>
  import("./pages/AccountAnalysis").then((m) => ({ default: m.AccountAnalysis })),
);
const Members = lazy(() => import("./pages/Members").then((m) => ({ default: m.Members })));
const ApprovalRules = lazy(() =>
  import("./pages/ApprovalRules").then((m) => ({ default: m.ApprovalRules })),
);
const PendingApprovals = lazy(() =>
  import("./pages/PendingApprovals").then((m) => ({ default: m.PendingApprovals })),
);
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));

function WelcomePage() {
  const { setOrganization } = useOrganization();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Välkommen till Munins bok</h2>
      <p style={{ marginBottom: "2rem", color: "var(--color-text-muted)" }}>
        Skapa din första organisation för att börja bokföra.
      </p>
      <button onClick={() => setShowCreate(true)}>Skapa organisation</button>
      <CreateOrganizationDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(org) => setOrganization(org)}
      />
    </div>
  );
}

function AppContent() {
  const { organization, fiscalYear, organizations } = useOrganization();
  const { logout, user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [reportsOpen, setReportsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const reportsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isReportPage = location.pathname.startsWith("/reports/");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Global search shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={styles.app}>
      <a href="#main-content" className={styles.skipLink} data-testid="skip-link">
        Hoppa till innehåll
      </a>
      <header className={styles.header} role="banner">
        <h1>Munins bok</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {organization && fiscalYear && (
            <button
              className="secondary"
              onClick={() => setSearchOpen(true)}
              title={`${t("common.search")} (Ctrl+K)`}
              style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}
            >
              🔍 {t("common.search")}
            </button>
          )}
          <OrganizationSelect />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "sv" | "en")}
            aria-label={t("nav.language")}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
          >
            <option value="sv">🇸🇪 SV</option>
            <option value="en">🇬🇧 EN</option>
          </select>
          <ThemeToggle />
          {user && (
            <div className={styles.userArea}>
              <span className={styles.userName} title={user.email}>
                {user.name}
              </span>
              <button className="secondary" onClick={logout} style={{ whiteSpace: "nowrap" }}>
                {t("nav.logout")}
              </button>
            </div>
          )}
        </div>
      </header>

      {organizations.length === 0 ? (
        <main id="main-content">
          <WelcomePage />
        </main>
      ) : organization && fiscalYear ? (
        <>
          <nav className={`${styles.nav} mb-2`} aria-label="Huvudnavigation">
            <span className={styles.navGroup}>
              <NavLink to="/dashboard">{t("nav.dashboard")}</NavLink>
              <NavLink to="/vouchers">{t("nav.vouchers")}</NavLink>
              <NavLink to="/templates">{t("nav.templates")}</NavLink>
              <NavLink to="/budgets">{t("nav.budgets")}</NavLink>
              <NavLink to="/accounts">{t("nav.accounts")}</NavLink>
            </span>
            <span className={styles.navSeparator} aria-hidden="true" />
            <div className={styles.dropdown} ref={reportsRef}>
              <button
                type="button"
                className={`${styles.dropdownToggle} ${isReportPage ? styles.dropdownActive : ""}`}
                onClick={() => setReportsOpen((o) => !o)}
                aria-expanded={reportsOpen}
                aria-haspopup="true"
              >
                {t("nav.reports")} ▾
              </button>
              {reportsOpen && (
                <div className={styles.dropdownMenu} role="menu">
                  <NavLink
                    to="/reports/trial-balance"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    {t("nav.trialBalance")}
                  </NavLink>
                  <NavLink
                    to="/reports/income-statement"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    {t("nav.incomeStatement")}
                  </NavLink>
                  <NavLink
                    to="/reports/balance-sheet"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    {t("nav.balanceSheet")}
                  </NavLink>
                  <NavLink to="/reports/vat" role="menuitem" onClick={() => setReportsOpen(false)}>
                    Moms
                  </NavLink>
                  <NavLink
                    to="/reports/vat-declaration"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    SKV 4700
                  </NavLink>
                  <NavLink
                    to="/reports/period"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    Periodrapport
                  </NavLink>
                  <NavLink
                    to="/reports/account-analysis"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    Kontoanalys
                  </NavLink>
                  <hr className={styles.dropdownDivider} />
                  <NavLink
                    to="/reports/journal"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    Grundbok
                  </NavLink>
                  <NavLink
                    to="/reports/general-ledger"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    Huvudbok
                  </NavLink>
                  <NavLink
                    to="/reports/voucher-list"
                    role="menuitem"
                    onClick={() => setReportsOpen(false)}
                  >
                    Verifikationslista
                  </NavLink>
                </div>
              )}
            </div>
            <span className={styles.navSeparator} aria-hidden="true" />
            <NavLink to="/sie">{t("nav.sieExport")}</NavLink>
            <NavLink to="/csv-import">{t("nav.csvImport")}</NavLink>
            <NavLink to="/fiscal-years">{t("nav.fiscalYears")}</NavLink>
            <NavLink to="/year-end-closing">{t("nav.yearEndClosing")}</NavLink>
            <NavLink to="/result-disposition">Disposition</NavLink>
            <NavLink to="/year-end-summary">Sammanställning</NavLink>
            <NavLink to="/members">{t("nav.members")}</NavLink>
            <NavLink to="/approval-rules">{t("nav.approval")}</NavLink>
            <NavLink to="/pending-approvals">{t("approval.pending")}</NavLink>
          </nav>

          <main id="main-content">
            <Suspense fallback={<div className="loading">{t("common.loading")}</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/vouchers" element={<VoucherList />} />
                <Route path="/vouchers/new" element={<VoucherCreate />} />
                <Route path="/vouchers/:voucherId" element={<VoucherDetail />} />
                <Route path="/templates" element={<VoucherTemplates />} />
                <Route path="/templates/new" element={<VoucherTemplateForm />} />
                <Route path="/templates/:templateId/edit" element={<VoucherTemplateForm />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/budgets/new" element={<BudgetForm />} />
                <Route path="/budgets/:budgetId/edit" element={<BudgetForm />} />
                <Route path="/budgets/:budgetId/vs-actual" element={<BudgetVsActual />} />
                <Route path="/accounts" element={<AccountList />} />
                <Route path="/reports/trial-balance" element={<TrialBalance />} />
                <Route path="/reports/income-statement" element={<IncomeStatement />} />
                <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
                <Route path="/reports/vat" element={<VatReport />} />
                <Route path="/reports/vat-declaration" element={<VatDeclaration />} />
                <Route path="/reports/period" element={<PeriodReport />} />
                <Route path="/reports/account-analysis" element={<AccountAnalysis />} />
                <Route path="/reports/journal" element={<Journal />} />
                <Route path="/reports/general-ledger" element={<GeneralLedger />} />
                <Route path="/reports/voucher-list" element={<VoucherListReport />} />
                <Route path="/sie" element={<SieExport />} />
                <Route path="/csv-import" element={<CsvImport />} />
                <Route path="/fiscal-years" element={<FiscalYears />} />
                <Route path="/year-end-closing" element={<YearEndClosing />} />
                <Route path="/result-disposition" element={<ResultDisposition />} />
                <Route path="/year-end-summary" element={<YearEndSummary />} />
                <Route path="/members" element={<Members />} />
                <Route path="/approval-rules" element={<ApprovalRules />} />
                <Route path="/pending-approvals" element={<PendingApprovals />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </>
      ) : organization ? (
        <main id="main-content">
          <div className="card">
            <p>
              Skapa ett räkenskapsår för att börja bokföra. Klicka <strong>+</strong> bredvid
              räkenskapsår-listan.
            </p>
          </div>
        </main>
      ) : (
        <main id="main-content">
          <div className="card">
            <p>Välj en organisation för att börja bokföra.</p>
          </div>
        </main>
      )}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <OrganizationProvider>
                    <AppContent />
                  </OrganizationProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </LocaleProvider>
  );
}
