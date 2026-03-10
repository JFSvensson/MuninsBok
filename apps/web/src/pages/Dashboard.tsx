import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";
import styles from "./Dashboard.module.css";

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
  const monthIndex = parseInt(parts[1] ?? "0", 10) - 1;
  return MONTH_NAMES[monthIndex] ?? key;
}

export function Dashboard() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", organization?.id, fiscalYear?.id],
    queryFn: () => api.getDashboard(defined(organization).id, defined(fiscalYear).id),
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
      <div className={styles.dashboardGrid}>
        <div className={`card ${styles.dashboardStat}`}>
          <div className={styles.statLabel}>Verifikat</div>
          <div className={styles.statValue}>{d.voucherCount}</div>
        </div>

        <div className={`card ${styles.dashboardStat}`}>
          <div className={styles.statLabel}>Konton</div>
          <div className={styles.statValue}>{d.accountCount}</div>
        </div>

        <div className={`card ${styles.dashboardStat}`}>
          <div className={styles.statLabel}>Resultat</div>
          <div
            className={`${styles.statValue} ${d.netResult >= 0 ? styles.positive : styles.negative}`}
          >
            {formatAmount(d.netResult)} kr
          </div>
        </div>

        <div className={`card ${styles.dashboardStat}`}>
          <div className={styles.statLabel}>Balans</div>
          <div
            className={`${styles.statValue} ${d.isBalanced ? styles.positive : styles.negative}`}
          >
            {d.isBalanced ? "✓ OK" : "✗ Obalans"}
          </div>
        </div>
      </div>

      {/* Monthly trend chart */}
      {d.monthlyTrend.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: "0.75rem" }}>Månadsöversikt</h3>
          <div
            className={styles.chartContainer}
            role="img"
            aria-label="Stapeldiagram med intäkter och kostnader per månad"
          >
            {d.monthlyTrend.map((m) => (
              <div key={m.month} className={styles.chartColumn}>
                <div className={styles.chartBars}>
                  <div
                    className={`${styles.chartBar} ${styles.chartBarIncome}`}
                    style={{
                      height: maxBarValue > 0 ? `${(m.income / maxBarValue) * 100}%` : "0%",
                    }}
                    title={`Intäkter: ${formatAmount(m.income)} kr`}
                  />
                  <div
                    className={`${styles.chartBar} ${styles.chartBarExpense}`}
                    style={{
                      height: maxBarValue > 0 ? `${(m.expense / maxBarValue) * 100}%` : "0%",
                    }}
                    title={`Kostnader: ${formatAmount(m.expense)} kr`}
                  />
                </div>
                <div className={styles.chartLabel}>{formatMonth(m.month)}</div>
                <div className={styles.chartCount}>{m.voucherCount} ver.</div>
              </div>
            ))}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.legendIncome}`} /> Intäkter
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.legendExpense}`} /> Kostnader
            </span>
          </div>
        </div>
      )}

      {/* Account type distribution */}
      {accountTypes.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: "0.75rem" }}>Kontofördelning</h3>
          <div className={styles.distributionBars}>
            {accountTypes
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className={styles.distRow}>
                  <span className={styles.distLabel}>{ACCOUNT_TYPE_LABELS[type] ?? type}</span>
                  <div className={styles.distTrack}>
                    <div
                      className={styles.distFill}
                      style={{
                        width: totalAccounts > 0 ? `${(count / totalAccounts) * 100}%` : "0%",
                      }}
                    />
                  </div>
                  <span className={styles.distCount}>{count}</span>
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
                <th scope="col">Nr</th>
                <th scope="col">Datum</th>
                <th scope="col">Beskrivning</th>
                <th scope="col" className="text-right">
                  Belopp
                </th>
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
