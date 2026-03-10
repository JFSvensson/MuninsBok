import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";
import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { useReportQuery } from "../hooks/useReportQuery";

export function VoucherListReport() {
  const { data, isLoading, error, setDateRange } = useReportQuery(
    "voucher-list-report",
    api.getVoucherListReport,
  );

  const report = data?.data;

  return (
    <ReportPageTemplate
      title={
        report && report.entries.length > 0
          ? `Verifikationslista (${report.count} verifikat)`
          : "Verifikationslista"
      }
      isLoading={isLoading}
      error={error}
      isEmpty={!report || report.entries.length === 0}
      loadingText="Laddar verifikationslista..."
      emptyText="Inga verifikat ännu."
      actions={
        report &&
        report.entries.length > 0 && (
          <button
            className="secondary"
            onClick={() => {
              const rows: string[][] = [];
              for (const entry of report.entries) {
                for (const line of entry.lines) {
                  rows.push([
                    String(entry.voucherNumber),
                    formatDate(entry.date),
                    entry.description,
                    entry.createdBy ?? "",
                    line.accountNumber,
                    line.accountName,
                    csvAmount(line.debit),
                    csvAmount(line.credit),
                  ]);
                }
              }
              const csv = toCsv(
                [
                  "Ver.nr",
                  "Datum",
                  "Beskrivning",
                  "Skapad av",
                  "Konto",
                  "Kontonamn",
                  "Debet",
                  "Kredit",
                ],
                rows,
              );
              downloadCsv(csv, "verifikationslista.csv");
            }}
          >
            Exportera CSV
          </button>
        )
      }
      filters={<DateFilter onFilter={setDateRange} />}
    >
      {report && (
        <table>
          <thead>
            <tr>
              <th scope="col">Ver.nr</th>
              <th scope="col">Datum</th>
              <th scope="col">Beskrivning</th>
              <th scope="col">Konto</th>
              <th scope="col">Kontonamn</th>
              <th scope="col" className="text-right">
                Debet
              </th>
              <th scope="col" className="text-right">
                Kredit
              </th>
            </tr>
          </thead>
          <tbody>
            {report.entries.map((entry) =>
              entry.lines.map((line, lineIdx) => (
                <tr key={`${entry.voucherId}-${lineIdx}`}>
                  {lineIdx === 0 ? (
                    <>
                      <td rowSpan={entry.lines.length}>{entry.voucherNumber}</td>
                      <td rowSpan={entry.lines.length}>{formatDate(entry.date)}</td>
                      <td rowSpan={entry.lines.length}>{entry.description}</td>
                    </>
                  ) : null}
                  <td>{line.accountNumber}</td>
                  <td>{line.accountName}</td>
                  <td className="text-right amount">
                    {line.debit > 0 ? formatAmount(line.debit) : ""}
                  </td>
                  <td className="text-right amount">
                    {line.credit > 0 ? formatAmount(line.credit) : ""}
                  </td>
                </tr>
              )),
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}>
              <td colSpan={5}>Summa</td>
              <td className="text-right amount">{formatAmount(report.totalDebit)}</td>
              <td className="text-right amount">{formatAmount(report.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ReportPageTemplate>
  );
}
