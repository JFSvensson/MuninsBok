import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api, type ReportSection } from "../api";
import { formatAmount, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";
import { DateFilter, type DateRange } from "../components/DateFilter";

function Section({ section }: { section: ReportSection }) {
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["income-statement", organization?.id, fiscalYear?.id, dateRange],
    queryFn: () => api.getIncomeStatement(organization!.id, fiscalYear!.id, dateRange),
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

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Resultaträkning</h2>
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
      </div>
      <div className="mb-2">
        <DateFilter onFilter={setDateRange} />
      </div>
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
            <td className={amountClassName(report.operatingResult)}>
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
            <td className={amountClassName(report.netResult)}>{formatAmount(report.netResult)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
