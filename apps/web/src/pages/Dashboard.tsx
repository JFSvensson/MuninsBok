import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "Tillgångar",
  LIABILITY: "Skulder",
  EQUITY: "Eget kapital",
  REVENUE: "Intäkter",
  EXPENSE: "Kostnader",
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

function formatMonth(key: string): string {
  const parts = key.split("-");
  const monthIndex = parseInt(parts[1]!, 10) - 1;
  return MONTH_NAMES[monthIndex] ?? key;
}

export function Dashboard() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", organization?.id, fiscalYear?.id],
    queryFn: () => api.getDashboard(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar översikt...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const d = data?.data;

  if (!d) {
    return (
      <div className="card">
        <h2>Översikt</h2>
        <div className="empty">Ingen data tillgänglig.</div>
      </div>
    );
  }

  // Compute max value for bar chart scaling
  const maxBarValue = d.monthlyTrend.reduce((max, m) => Math.max(max, m.income, m.expense), 0);

  const accountTypes = Object.entries(d.accountTypeCounts);
  const totalAccounts = accountTypes.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>Översikt</h2>

      {/* KPI cards */}
      <div className="dashboard-grid">
        <div className="card dashboard-stat">
          <div className="stat-label">Verifikat</div>
          <div className="stat-value">{d.voucherCount}</div>
        </div>

        <div className="card dashboard-stat">
          <div className="stat-label">Konton</div>
          <div className="stat-value">{d.accountCount}</div>
        </div>

        <div className="card dashboard-stat">
          <div className="stat-label">Resultat</div>
          <div className={`stat-value ${d.netResult >= 0 ? "positive" : "negative"}`}>
            {formatAmount(d.netResult)} kr
          </div>
        </div>

        <div className="card dashboard-stat">
          <div className="stat-label">Balans</div>
          <div className={`stat-value ${d.isBalanced ? "positive" : "negative"}`}>
            {d.isBalanced ? "✓ OK" : "✗ Obalans"}
          </div>
        </div>
      </div>

      {/* Monthly trend chart */}
      {d.monthlyTrend.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: "0.75rem" }}>Månadsöversikt</h3>
          <div
            className="chart-container"
            role="img"
            aria-label="Stapeldiagram med intäkter och kostnader per månad"
          >
            {d.monthlyTrend.map((m) => (
              <div key={m.month} className="chart-column">
                <div className="chart-bars">
                  <div
                    className="chart-bar chart-bar-income"
                    style={{
                      height: maxBarValue > 0 ? `${(m.income / maxBarValue) * 100}%` : "0%",
                    }}
                    title={`Intäkter: ${formatAmount(m.income)} kr`}
                  />
                  <div
                    className="chart-bar chart-bar-expense"
                    style={{
                      height: maxBarValue > 0 ? `${(m.expense / maxBarValue) * 100}%` : "0%",
                    }}
                    title={`Kostnader: ${formatAmount(m.expense)} kr`}
                  />
                </div>
                <div className="chart-label">{formatMonth(m.month)}</div>
                <div className="chart-count">{m.voucherCount} ver.</div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch legend-income" /> Intäkter
            </span>
            <span className="legend-item">
              <span className="legend-swatch legend-expense" /> Kostnader
            </span>
          </div>
        </div>
      )}

      {/* Account type distribution */}
      {accountTypes.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: "0.75rem" }}>Kontofördelning</h3>
          <div className="distribution-bars">
            {accountTypes
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="dist-row">
                  <span className="dist-label">{ACCOUNT_TYPE_LABELS[type] ?? type}</span>
                  <div className="dist-track">
                    <div
                      className="dist-fill"
                      style={{
                        width: totalAccounts > 0 ? `${(count / totalAccounts) * 100}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="dist-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Latest vouchers */}
      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Senaste verifikat</h3>
        {d.latestVouchers.length === 0 ? (
          <div className="empty">Inga verifikat ännu.</div>
        ) : (
          <table>
            <caption className="sr-only">Senaste 5 verifikat</caption>
            <thead>
              <tr>
                <th>Nr</th>
                <th>Datum</th>
                <th>Beskrivning</th>
                <th className="text-right">Belopp</th>
              </tr>
            </thead>
            <tbody>
              {d.latestVouchers.map((v) => (
                <tr
                  key={v.id}
                  className="clickable-row"
                  onClick={() => navigate(`/vouchers/${v.id}`)}
                >
                  <td>{v.number}</td>
                  <td>{formatDate(v.date)}</td>
                  <td>{v.description}</td>
                  <td className="text-right amount">{formatAmount(v.amount)} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick links */}
      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Snabblänkar</h3>
        <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
          <button onClick={() => navigate("/vouchers/new")}>+ Nytt verifikat</button>
          <button className="secondary" onClick={() => navigate("/vouchers")}>
            Alla verifikat
          </button>
          <button className="secondary" onClick={() => navigate("/reports/trial-balance")}>
            Råbalans
          </button>
          <button className="secondary" onClick={() => navigate("/reports/income-statement")}>
            Resultaträkning
          </button>
          <button className="secondary" onClick={() => navigate("/reports/balance-sheet")}>
            Balansräkning
          </button>
        </div>
      </div>
    </div>
  );
}
