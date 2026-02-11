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
          <td className="text-right amount">{formatAmount(row.amount)}</td>
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

export function IncomeStatement() {
  const { organization, fiscalYear } = useOrganization();

  const { data, isLoading, error } = useQuery({
    queryKey: ["income-statement", organization?.id, fiscalYear?.id],
    queryFn: () => api.getIncomeStatement(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar resultaträkning...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report) {
    return (
      <div className="card">
        <h2>Resultaträkning</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  const formatAmount = (amount: number) =>
    amount.toLocaleString("sv-SE", { minimumFractionDigits: 2 });

  return (
    <div className="card">
      <h2>Resultaträkning</h2>
      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Namn</th>
            <th className="text-right">Belopp</th>
          </tr>
        </thead>
        <tbody>
          <Section section={report.revenues} />
          <Section section={report.expenses} />

          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={2}>Rörelseresultat</td>
            <td
              className={`text-right amount ${report.operatingResult >= 0 ? "positive" : "negative"}`}
            >
              {formatAmount(report.operatingResult)}
            </td>
          </tr>

          <Section section={report.financialIncome} />
          <Section section={report.financialExpenses} />

          <tr
            style={{
              fontWeight: "bold",
              borderTop: "3px double #333",
              fontSize: "1.1em",
            }}
          >
            <td colSpan={2}>Årets resultat</td>
            <td
              className={`text-right amount ${report.netResult >= 0 ? "positive" : "negative"}`}
            >
              {formatAmount(report.netResult)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
