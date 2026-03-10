import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { useReportQuery } from "../hooks/useReportQuery";

export function VatReport() {
  const { data, isLoading, error, setDateRange, organization, fiscalYear } = useReportQuery(
    "vat-report",
    api.getVatReport,
  );

  const report = data?.data;
  const hasData = report ? report.outputVat.length > 0 || report.inputVat.length > 0 : false;

  return (
    <ReportPageTemplate
      title="Momsrapport"
      isLoading={isLoading}
      error={error}
      isEmpty={!report || !hasData}
      loadingText="Laddar momsrapport..."
      emptyText={
        !report
          ? "Inga bokförda transaktioner ännu."
          : "Inga momstransaktioner för detta räkenskapsår."
      }
      actions={
        report &&
        hasData && (
          <>
            <button
              className="secondary"
              onClick={() => {
                const allRows = [
                  ...report.outputVat.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Utgående",
                    csvAmount(r.amount),
                  ]),
                  ["", "Summa utgående moms", "", csvAmount(report.totalOutputVat)],
                  ...report.inputVat.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Ingående",
                    csvAmount(r.amount),
                  ]),
                  ["", "Summa ingående moms", "", csvAmount(report.totalInputVat)],
                  [
                    "",
                    report.vatPayable >= 0 ? "Moms att betala" : "Momsfordran",
                    "",
                    csvAmount(report.vatPayable),
                  ],
                ];
                const csv = toCsv(["Konto", "Namn", "Typ", "Belopp"], allRows);
                downloadCsv(csv, "momsrapport.csv");
              }}
            >
              Exportera CSV
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const { exportVatReportPdf } = await import("../utils/pdf");
                exportVatReportPdf(
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
                Belopp (kr)
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Utgående moms */}
            {report.outputVat.length > 0 && (
              <>
                <tr>
                  <td colSpan={3} style={{ fontWeight: "bold", paddingTop: "1rem" }}>
                    Utgående moms
                  </td>
                </tr>
                {report.outputVat.map((row) => (
                  <tr key={row.accountNumber}>
                    <td style={{ paddingLeft: "1rem" }}>{row.accountNumber}</td>
                    <td>{row.accountName}</td>
                    <td className="text-right amount">{formatAmount(row.amount)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold" }}>
                  <td colSpan={2} style={{ paddingLeft: "1rem" }}>
                    Summa utgående moms
                  </td>
                  <td className="text-right amount">{formatAmount(report.totalOutputVat)}</td>
                </tr>
              </>
            )}

            {/* Ingående moms */}
            {report.inputVat.length > 0 && (
              <>
                <tr>
                  <td colSpan={3} style={{ fontWeight: "bold", paddingTop: "1rem" }}>
                    Ingående moms (avdragsgill)
                  </td>
                </tr>
                {report.inputVat.map((row) => (
                  <tr key={row.accountNumber}>
                    <td style={{ paddingLeft: "1rem" }}>{row.accountNumber}</td>
                    <td>{row.accountName}</td>
                    <td className="text-right amount">{formatAmount(row.amount)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold" }}>
                  <td colSpan={2} style={{ paddingLeft: "1rem" }}>
                    Summa ingående moms
                  </td>
                  <td className="text-right amount">{formatAmount(report.totalInputVat)}</td>
                </tr>
              </>
            )}

            {/* Resultat */}
            <tr style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}>
              <td colSpan={2}>{report.vatPayable >= 0 ? "Moms att betala" : "Momsfordran"}</td>
              <td className={amountClassName(report.vatPayable)}>
                {formatAmount(Math.abs(report.vatPayable))} kr
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </ReportPageTemplate>
  );
}
