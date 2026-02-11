import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { OrganizationSelect } from "./components/OrganizationSelect";
import { VoucherList } from "./pages/VoucherList";
import { VoucherCreate } from "./pages/VoucherCreate";
import { TrialBalance } from "./pages/TrialBalance";
import { IncomeStatement } from "./pages/IncomeStatement";
import { BalanceSheet } from "./pages/BalanceSheet";
import { SieExport } from "./pages/SieExport";

function AppContent() {
  const { organization, fiscalYear } = useOrganization();

  return (
    <div className="app">
      <header className="header">
        <h1>Munins bok</h1>
        <OrganizationSelect />
      </header>

      {organization && fiscalYear ? (
        <>
          <nav className="nav mb-2">
            <NavLink to="/vouchers">Verifikat</NavLink>
            <NavLink to="/vouchers/new">Nytt verifikat</NavLink>
            <NavLink to="/reports/trial-balance">Råbalans</NavLink>
            <NavLink to="/reports/income-statement">Resultaträkning</NavLink>
            <NavLink to="/reports/balance-sheet">Balansräkning</NavLink>
            <NavLink to="/sie">SIE</NavLink>
          </nav>

          <Routes>
            <Route path="/" element={<Navigate to="/vouchers" replace />} />
            <Route path="/vouchers" element={<VoucherList />} />
            <Route path="/vouchers/new" element={<VoucherCreate />} />
            <Route path="/reports/trial-balance" element={<TrialBalance />} />
            <Route path="/reports/income-statement" element={<IncomeStatement />} />
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/sie" element={<SieExport />} />
          </Routes>
        </>
      ) : (
        <div className="card">
          <p>Välj en organisation för att börja bokföra.</p>
        </div>
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
