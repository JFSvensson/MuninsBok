import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";
import { DateFilter, type DateRange } from "../components/DateFilter";

export function VatReport() {
  const { organization, fiscalYear } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["vat-report", organization?.id, fiscalYear?.id, dateRange],
    queryFn: () => api.getVatReport(organization!.id, fiscalYear!.id, dateRange),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar momsrapport...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report) {
    return (
      <div className="card">
        <h2>Momsrapport</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  const hasData = report.outputVat.length > 0 || report.inputVat.length > 0;

  if (!hasData) {
    return (
      <div className="card">
        <h2>Momsrapport</h2>
        <div className="empty">Inga momstransaktioner för detta räkenskapsår.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Momsrapport</h2>
        <button
          className="secondary"
          onClick={() => {
            const allRows = [
              ...report.outputVat.map((r) => [r.accountNumber, r.accountName, "Utgående", csvAmount(r.amount)]),
              ["", "Summa utgående moms", "", csvAmount(report.totalOutputVat)],
              ...report.inputVat.map((r) => [r.accountNumber, r.accountName, "Ingående", csvAmount(r.amount)]),
              ["", "Summa ingående moms", "", csvAmount(report.totalInputVat)],
              ["", report.vatPayable >= 0 ? "Moms att betala" : "Momsfordran", "", csvAmount(report.vatPayable)],
            ];
            const csv = toCsv(["Konto", "Namn", "Typ", "Belopp"], allRows);
            downloadCsv(csv, "momsrapport.csv");
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
            <th>Konto</th>
            <th>Namn</th>
            <th className="text-right">Belopp (kr)</th>
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
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={2}>
              {report.vatPayable >= 0 ? "Moms att betala" : "Momsfordran"}
            </td>
            <td className={amountClassName(report.vatPayable)}>
              {formatAmount(Math.abs(report.vatPayable))} kr
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
