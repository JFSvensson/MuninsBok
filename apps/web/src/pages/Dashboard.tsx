import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";

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

  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>Översikt</h2>

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

      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Senaste verifikat</h3>
        {d.latestVouchers.length === 0 ? (
          <div className="empty">Inga verifikat ännu.</div>
        ) : (
          <table>
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

      <div className="card">
        <h3 style={{ marginBottom: "0.75rem" }}>Snabblänkar</h3>
        <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
          <button onClick={() => navigate("/vouchers/new")}>+ Nytt verifikat</button>
          <button className="secondary" onClick={() => navigate("/vouchers")}>Alla verifikat</button>
          <button className="secondary" onClick={() => navigate("/reports/trial-balance")}>Råbalans</button>
          <button className="secondary" onClick={() => navigate("/reports/income-statement")}>Resultaträkning</button>
          <button className="secondary" onClick={() => navigate("/reports/balance-sheet")}>Balansräkning</button>
        </div>
      </div>
    </div>
  );
}
