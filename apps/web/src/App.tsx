import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import styles from "./App.module.css";
import { OrganizationSelect } from "./components/OrganizationSelect";
import { lazy, Suspense, useState } from "react";
import { CreateOrganizationDialog } from "./components/CreateOrganizationDialog";

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
const Journal = lazy(() => import("./pages/Journal").then((m) => ({ default: m.Journal })));
const GeneralLedger = lazy(() =>
  import("./pages/GeneralLedger").then((m) => ({ default: m.GeneralLedger })),
);
const VoucherListReport = lazy(() =>
  import("./pages/VoucherListReport").then((m) => ({ default: m.VoucherListReport })),
);
const SieExport = lazy(() => import("./pages/SieExport").then((m) => ({ default: m.SieExport })));
const FiscalYears = lazy(() =>
  import("./pages/FiscalYears").then((m) => ({ default: m.FiscalYears })),
);
const Members = lazy(() => import("./pages/Members").then((m) => ({ default: m.Members })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));

function WelcomePage() {
  const { setOrganization } = useOrganization();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>Välkommen till Munins bok</h2>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
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

  return (
    <div className={styles.app}>
      <a href="#main-content" className={styles.skipLink}>
        Hoppa till innehåll
      </a>
      <header className={styles.header} role="banner">
        <h1>Munins bok</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <OrganizationSelect />
          {user && (
            <div className={styles.userArea}>
              <span className={styles.userName} title={user.email}>
                {user.name}
              </span>
              <button className="secondary" onClick={logout} style={{ whiteSpace: "nowrap" }}>
                Logga ut
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
              <NavLink to="/dashboard">Översikt</NavLink>
              <NavLink to="/vouchers">Verifikat</NavLink>
              <NavLink to="/accounts">Kontoplan</NavLink>
            </span>
            <span className={styles.navSeparator} aria-hidden="true" />
            <span className={styles.navGroup}>
              <NavLink to="/reports/trial-balance">Råbalans</NavLink>
              <NavLink to="/reports/income-statement">Resultaträkning</NavLink>
              <NavLink to="/reports/balance-sheet">Balansräkning</NavLink>
              <NavLink to="/reports/vat">Moms</NavLink>
            </span>
            <span className={styles.navSeparator} aria-hidden="true" />
            <span className={styles.navGroup}>
              <NavLink to="/reports/journal">Grundbok</NavLink>
              <NavLink to="/reports/general-ledger">Huvudbok</NavLink>
              <NavLink to="/reports/voucher-list">Verifikationslista</NavLink>
            </span>
            <span className={styles.navSeparator} aria-hidden="true" />
            <NavLink to="/sie">SIE</NavLink>
            <NavLink to="/fiscal-years">Räkenskapsår</NavLink>
            <NavLink to="/members">Medlemmar</NavLink>
          </nav>

          <main id="main-content">
            <Suspense fallback={<div className="loading">Laddar…</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/vouchers" element={<VoucherList />} />
                <Route path="/vouchers/new" element={<VoucherCreate />} />
                <Route path="/vouchers/:voucherId" element={<VoucherDetail />} />
                <Route path="/accounts" element={<AccountList />} />
                <Route path="/reports/trial-balance" element={<TrialBalance />} />
                <Route path="/reports/income-statement" element={<IncomeStatement />} />
                <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
                <Route path="/reports/vat" element={<VatReport />} />
                <Route path="/reports/journal" element={<Journal />} />
                <Route path="/reports/general-ledger" element={<GeneralLedger />} />
                <Route path="/reports/voucher-list" element={<VoucherListReport />} />
                <Route path="/sie" element={<SieExport />} />
                <Route path="/fiscal-years" element={<FiscalYears />} />
                <Route path="/members" element={<Members />} />
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
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="loading">Laddar…</div>}>
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
  );
}
