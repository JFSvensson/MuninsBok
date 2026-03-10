import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { useReportQuery } from "../hooks/useReportQuery";

export function TrialBalance() {
  const { data, isLoading, error, setDateRange, organization, fiscalYear } = useReportQuery(
    "trial-balance",
    api.getTrialBalance,
  );

  const report = data?.data;

  return (
    <ReportPageTemplate
      title="Råbalans"
      isLoading={isLoading}
      error={error}
      isEmpty={!report || report.rows.length === 0}
      loadingText="Laddar råbalans..."
      actions={
        report &&
        report.rows.length > 0 && (
          <>
            <button
              className="secondary"
              onClick={() => {
                const csv = toCsv(
                  ["Konto", "Namn", "Debet", "Kredit", "Saldo"],
                  report.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    csvAmount(r.debit),
                    csvAmount(r.credit),
                    csvAmount(r.balance),
                  ]),
                );
                downloadCsv(csv, "rabalans.csv");
              }}
            >
              Exportera CSV
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const { exportTrialBalancePdf } = await import("../utils/pdf");
                exportTrialBalancePdf(
                  report,
                  organization?.name ?? "",
                  fiscalYear
                    ? formatDate(fiscalYear.startDate) + " – " + formatDate(fiscalYear.endDate)
                    : "",
                );
              }}
            >
              Exportera PDF
            </button>
          </>
        )
      }
      filters={<DateFilter onFilter={setDateRange} />}
    >
      {report && (
        <table>
          <thead>
            <tr>
              <th scope="col">Konto</th>
              <th scope="col">Namn</th>
              <th scope="col" className="text-right">
                Debet
              </th>
              <th scope="col" className="text-right">
                Kredit
              </th>
              <th scope="col" className="text-right">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.accountNumber}>
                <td>{row.accountNumber}</td>
                <td>{row.accountName}</td>
                <td className="text-right amount">{formatAmount(row.debit)}</td>
                <td className="text-right amount">{formatAmount(row.credit)}</td>
                <td className={amountClassName(row.balance)}>{formatAmount(row.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}>
              <td colSpan={2}>Summa</td>
              <td className="text-right amount">{formatAmount(report.totalDebit)}</td>
              <td className="text-right amount">{formatAmount(report.totalCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </ReportPageTemplate>
  );
}
