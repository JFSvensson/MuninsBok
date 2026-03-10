import type { ReportSection } from "../api";
import { formatAmount } from "../utils/formatting";

export function ReportSectionRows({ section }: { section: ReportSection }) {
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
