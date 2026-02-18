import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { OrganizationSelect } from "./components/OrganizationSelect";
import { VoucherList } from "./pages/VoucherList";
import { VoucherCreate } from "./pages/VoucherCreate";
import { VoucherDetail } from "./pages/VoucherDetail";
import { AccountList } from "./pages/AccountList";
import { Dashboard } from "./pages/Dashboard";
import { TrialBalance } from "./pages/TrialBalance";
import { IncomeStatement } from "./pages/IncomeStatement";
import { BalanceSheet } from "./pages/BalanceSheet";
import { VatReport } from "./pages/VatReport";
import { Journal } from "./pages/Journal";
import { GeneralLedger } from "./pages/GeneralLedger";
import { VoucherListReport } from "./pages/VoucherListReport";
import { SieExport } from "./pages/SieExport";
import { useState } from "react";
import { CreateOrganizationDialog } from "./components/CreateOrganizationDialog";

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

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Hoppa till innehåll
      </a>
      <header className="header" role="banner">
        <h1>Munins bok</h1>
        <OrganizationSelect />
      </header>

      {organizations.length === 0 ? (
        <main id="main-content">
          <WelcomePage />
        </main>
      ) : organization && fiscalYear ? (
        <>
          <nav className="nav mb-2" aria-label="Huvudnavigation">
            <span className="nav-group">
              <NavLink to="/dashboard">Översikt</NavLink>
              <NavLink to="/vouchers">Verifikat</NavLink>
              <NavLink to="/accounts">Kontoplan</NavLink>
            </span>
            <span className="nav-separator" aria-hidden="true" />
            <span className="nav-group">
              <NavLink to="/reports/trial-balance">Råbalans</NavLink>
              <NavLink to="/reports/income-statement">Resultaträkning</NavLink>
              <NavLink to="/reports/balance-sheet">Balansräkning</NavLink>
              <NavLink to="/reports/vat">Moms</NavLink>
            </span>
            <span className="nav-separator" aria-hidden="true" />
            <span className="nav-group">
              <NavLink to="/reports/journal">Grundbok</NavLink>
              <NavLink to="/reports/general-ledger">Huvudbok</NavLink>
              <NavLink to="/reports/voucher-list">Verifikationslista</NavLink>
            </span>
            <span className="nav-separator" aria-hidden="true" />
            <NavLink to="/sie">SIE</NavLink>
          </nav>

          <main id="main-content">
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
          </Routes>
          </main>
        </>
      ) : organization ? (
        <main id="main-content">
          <div className="card">
            <p>Skapa ett räkenskapsår för att börja bokföra. Klicka <strong>+</strong> bredvid räkenskapsår-listan.</p>
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
    <OrganizationProvider>
      <AppContent />
    </OrganizationProvider>
  );
}
