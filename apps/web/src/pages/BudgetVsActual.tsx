import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import { formatAmount, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

export function BudgetVsActual() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { organization } = useOrganization();
  const navigate = useNavigate();

  const orgId = defined(organization).id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["budget-vs-actual", orgId, budgetId],
    queryFn: () => api.getBudgetVsActual(orgId, budgetId as string),
    enabled: Boolean(budgetId),
  });

  if (isLoading) {
    return <div className="loading">Laddar budget mot utfall…</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report) {
    return (
      <div className="card">
        <h2>Budget mot utfall</h2>
        <div className="empty">Kunde inte ladda rapporten.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Budget mot utfall — {report.budgetName}</h2>
        <div className="flex" style={{ gap: "0.5rem" }}>
          <button
            className="secondary"
            onClick={() => {
              const csv = toCsv(
                ["Konto", "Namn", "Budget (kr)", "Utfall (kr)", "Avvikelse (kr)", "Avvikelse (%)"],
                report.rows.map((r) => [
                  r.accountNumber,
                  r.accountName,
                  csvAmount(r.budget),
                  csvAmount(r.actual),
                  csvAmount(r.deviation),
                  r.deviationPercent != null ? csvAmount(r.deviationPercent) : "—",
                ]),
              );
              downloadCsv(csv, `budget-vs-utfall-${report.budgetName}.csv`);
            }}
          >
            Exportera CSV
          </button>
          <button
            className="secondary"
            onClick={async () => {
              const { exportBudgetVsActualPdf } = await import("../utils/pdf");
              exportBudgetVsActualPdf(report, organization?.name ?? "");
            }}
          >
            Exportera PDF
          </button>
          <button className="secondary" onClick={() => navigate("/budgets")}>
            Tillbaka
          </button>
        </div>
      </div>

      {report.rows.length === 0 ? (
        <div className="empty">Inga poster att visa.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Konto</th>
              <th scope="col">Namn</th>
              <th scope="col" className="text-right">
                Budget
              </th>
              <th scope="col" className="text-right">
                Utfall
              </th>
              <th scope="col" className="text-right">
                Avvikelse
              </th>
              <th scope="col" className="text-right">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.accountNumber}>
                <td>{row.accountNumber}</td>
                <td>{row.accountName}</td>
                <td className="text-right">{formatAmount(row.budget)}</td>
                <td className="text-right">{formatAmount(row.actual)}</td>
                <td className={`text-right ${amountClassName(row.deviation)}`}>
                  {formatAmount(row.deviation)}
                </td>
                <td className="text-right">
                  {row.deviationPercent != null ? `${row.deviationPercent.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <strong>Totalt</strong>
              </td>
              <td className="text-right">
                <strong>{formatAmount(report.totalBudget)}</strong>
              </td>
              <td className="text-right">
                <strong>{formatAmount(report.totalActual)}</strong>
              </td>
              <td className={`text-right ${amountClassName(report.totalDeviation)}`}>
                <strong>{formatAmount(report.totalDeviation)}</strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
