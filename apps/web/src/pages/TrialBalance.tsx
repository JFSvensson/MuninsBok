import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, amountClassName } from "../utils/formatting";

export function TrialBalance() {
  const { organization, fiscalYear } = useOrganization();

  const { data, isLoading, error } = useQuery({
    queryKey: ["trial-balance", organization?.id, fiscalYear?.id],
    queryFn: () => api.getTrialBalance(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar råbalans...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report || report.rows.length === 0) {
    return (
      <div className="card">
        <h2>Råbalans</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Råbalans</h2>
      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Namn</th>
            <th className="text-right">Debet</th>
            <th className="text-right">Kredit</th>
            <th className="text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.accountNumber}>
              <td>{row.accountNumber}</td>
              <td>{row.accountName}</td>
              <td className="text-right amount">{formatAmount(row.debit)}</td>
              <td className="text-right amount">{formatAmount(row.credit)}</td>
              <td className={amountClassName(row.balance)}>
                {formatAmount(row.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={2}>Summa</td>
            <td className="text-right amount">{formatAmount(report.totalDebit)}</td>
            <td className="text-right amount">{formatAmount(report.totalCredit)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
