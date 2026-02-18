import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";
import { DateFilter, type DateRange } from "../components/DateFilter";

export function Journal() {
  const { organization, fiscalYear } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["journal", organization?.id, fiscalYear?.id, dateRange],
    queryFn: () => api.getJournal(organization!.id, fiscalYear!.id, dateRange),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar grundbok...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report || report.entries.length === 0) {
    return (
      <div className="card">
        <h2>Grundbok</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Grundbok</h2>
        <button
          className="secondary"
          onClick={() => {
            const rows: string[][] = [];
            for (const entry of report.entries) {
              for (const line of entry.lines) {
                rows.push([
                  formatDate(entry.date),
                  String(entry.voucherNumber),
                  entry.description,
                  line.accountNumber,
                  line.accountName,
                  csvAmount(line.debit),
                  csvAmount(line.credit),
                ]);
              }
            }
            const csv = toCsv(
              ["Datum", "Ver.nr", "Beskrivning", "Konto", "Kontonamn", "Debet", "Kredit"],
              rows
            );
            downloadCsv(csv, "grundbok.csv");
          }}
        >
          Exportera CSV
        </button>
      </div>
      <div className="mb-2">
        <DateFilter onFilter={setDateRange} />
      </div>
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Ver.nr</th>
            <th>Beskrivning</th>
            <th>Konto</th>
            <th>Kontonamn</th>
            <th className="text-right">Debet</th>
            <th className="text-right">Kredit</th>
          </tr>
        </thead>
        <tbody>
          {report.entries.map((entry) =>
            entry.lines.map((line, lineIdx) => (
              <tr key={`${entry.voucherId}-${lineIdx}`}>
                {lineIdx === 0 ? (
                  <>
                    <td rowSpan={entry.lines.length}>{formatDate(entry.date)}</td>
                    <td rowSpan={entry.lines.length}>{entry.voucherNumber}</td>
                    <td rowSpan={entry.lines.length}>{entry.description}</td>
                  </>
                ) : null}
                <td>{line.accountNumber}</td>
                <td>{line.accountName}</td>
                <td className="text-right amount">{line.debit > 0 ? formatAmount(line.debit) : ""}</td>
                <td className="text-right amount">{line.credit > 0 ? formatAmount(line.credit) : ""}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={5}>Summa</td>
            <td className="text-right amount">{formatAmount(report.totalDebit)}</td>
            <td className="text-right amount">{formatAmount(report.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
