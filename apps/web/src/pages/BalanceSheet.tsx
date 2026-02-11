import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api, type ReportSection } from "../api";

function Section({ section }: { section: ReportSection }) {
  const formatAmount = (amount: number) =>
    amount.toLocaleString("sv-SE", { minimumFractionDigits: 2 });

  if (section.rows.length === 0) {
    return null;
  }

  return (
    <>
      <tr>
        <td colSpan={3} style={{ fontWeight: "bold", paddingTop: "1rem" }}>
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.accountNumber}>
          <td style={{ paddingLeft: "1rem" }}>{row.accountNumber}</td>
          <td>{row.accountName}</td>
          <td className="text-right amount">{formatAmount(row.balance)}</td>
        </tr>
      ))}
      <tr style={{ fontWeight: "bold" }}>
        <td colSpan={2} style={{ paddingLeft: "1rem" }}>
          Summa {section.title.toLowerCase()}
        </td>
        <td className="text-right amount">{formatAmount(section.total)}</td>
      </tr>
    </>
  );
}

export function BalanceSheet() {
  const { organization, fiscalYear } = useOrganization();

  const { data, isLoading, error } = useQuery({
    queryKey: ["balance-sheet", organization?.id, fiscalYear?.id],
    queryFn: () => api.getBalanceSheet(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar balansräkning...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report) {
    return (
      <div className="card">
        <h2>Balansräkning</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  const formatAmount = (amount: number) =>
    amount.toLocaleString("sv-SE", { minimumFractionDigits: 2 });

  return (
    <div className="card">
      <h2>Balansräkning</h2>

      <div className="flex gap-2" style={{ alignItems: "flex-start" }}>
        {/* Assets (left side) */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Tillgångar</h3>
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Namn</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <Section section={report.assets} />
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={2}>Summa tillgångar</td>
                <td className="text-right amount">
                  {formatAmount(report.totalAssets)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Liabilities & Equity (right side) */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Eget kapital och skulder</h3>
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Namn</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <Section section={report.equity} />

              {report.yearResult !== 0 && (
                <tr>
                  <td style={{ paddingLeft: "1rem" }}></td>
                  <td>Årets resultat</td>
                  <td
                    className={`text-right amount ${report.yearResult >= 0 ? "positive" : "negative"}`}
                  >
                    {formatAmount(report.yearResult)}
                  </td>
                </tr>
              )}

              <Section section={report.liabilities} />

              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={2}>Summa eget kapital och skulder</td>
                <td className="text-right amount">
                  {formatAmount(report.totalLiabilitiesAndEquity)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {report.difference !== 0 && (
        <div className="error" style={{ marginTop: "1rem" }}>
          Varning: Balansräkningen balanserar inte! Differens:{" "}
          {formatAmount(report.difference)} kr
        </div>
      )}
    </div>
  );
}
