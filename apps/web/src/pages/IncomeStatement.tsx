import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { ReportSectionRows } from "../components/ReportSectionRows";
import { useReportQuery } from "../hooks/useReportQuery";

export function IncomeStatement() {
  const { data, isLoading, error, setDateRange, organization, fiscalYear } = useReportQuery(
    "income-statement",
    api.getIncomeStatement,
  );

  const report = data?.data;

  return (
    <ReportPageTemplate
      title="Resultaträkning"
      isLoading={isLoading}
      error={error}
      isEmpty={!report}
      loadingText="Laddar resultaträkning..."
      actions={
        report && (
          <>
            <button
              className="secondary"
              onClick={() => {
                const allRows = [
                  ...report.revenues.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Intäkt",
                    csvAmount(r.amount),
                  ]),
                  ...report.expenses.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Kostnad",
                    csvAmount(r.amount),
                  ]),
                  ...report.financialIncome.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Finansiell intäkt",
                    csvAmount(r.amount),
                  ]),
                  ...report.financialExpenses.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Finansiell kostnad",
                    csvAmount(r.amount),
                  ]),
                  ["", "Rörelseresultat", "", csvAmount(report.operatingResult)],
                  ["", "Årets resultat", "", csvAmount(report.netResult)],
                ];
                const csv = toCsv(["Konto", "Namn", "Kategori", "Belopp"], allRows);
                downloadCsv(csv, "resultatrakning.csv");
              }}
            >
              Exportera CSV
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const { exportIncomeStatementPdf } = await import("../utils/pdf");
                exportIncomeStatementPdf(
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
                Belopp
              </th>
            </tr>
          </thead>
          <tbody>
            <ReportSectionRows section={report.revenues} />
            <ReportSectionRows section={report.expenses} />

            <tr style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}>
              <td colSpan={2}>Rörelseresultat</td>
              <td className={amountClassName(report.operatingResult)}>
                {formatAmount(report.operatingResult)}
              </td>
            </tr>

            <ReportSectionRows section={report.financialIncome} />
            <ReportSectionRows section={report.financialExpenses} />

            <tr
              style={{
                fontWeight: "bold",
                borderTop: "3px double var(--color-border-dark)",
                fontSize: "1.1em",
              }}
            >
              <td colSpan={2}>Årets resultat</td>
              <td className={amountClassName(report.netResult)}>
                {formatAmount(report.netResult)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </ReportPageTemplate>
  );
}
