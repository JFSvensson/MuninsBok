import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

export function GeneralLedger() {
  const { organization, fiscalYear } = useOrganization();

  const { data, isLoading, error } = useQuery({
    queryKey: ["general-ledger", organization?.id, fiscalYear?.id],
    queryFn: () => api.getGeneralLedger(organization!.id, fiscalYear!.id),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar huvudbok...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report = data?.data;

  if (!report || report.accounts.length === 0) {
    return (
      <div className="card">
        <h2>Huvudbok</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Huvudbok</h2>
        <button
          className="secondary"
          onClick={() => {
            const rows: string[][] = [];
            for (const account of report.accounts) {
              for (const txn of account.transactions) {
                rows.push([
                  account.accountNumber,
                  account.accountName,
                  formatDate(txn.date),
                  String(txn.voucherNumber),
                  txn.description,
                  csvAmount(txn.debit),
                  csvAmount(txn.credit),
                  csvAmount(txn.balance),
                ]);
              }
            }
            const csv = toCsv(
              ["Konto", "Kontonamn", "Datum", "Ver.nr", "Beskrivning", "Debet", "Kredit", "Saldo"],
              rows
            );
            downloadCsv(csv, "huvudbok.csv");
          }}
        >
          Exportera CSV
        </button>
      </div>

      {report.accounts.map((account) => (
        <div key={account.accountNumber} style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>
            {account.accountNumber} – {account.accountName}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Ver.nr</th>
                <th>Beskrivning</th>
                <th className="text-right">Debet</th>
                <th className="text-right">Kredit</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {account.transactions.map((txn, idx) => (
                <tr key={`${txn.voucherId}-${idx}`}>
                  <td>{formatDate(txn.date)}</td>
                  <td>{txn.voucherNumber}</td>
                  <td>{txn.description}</td>
                  <td className="text-right amount">
                    {txn.debit > 0 ? formatAmount(txn.debit) : ""}
                  </td>
                  <td className="text-right amount">
                    {txn.credit > 0 ? formatAmount(txn.credit) : ""}
                  </td>
                  <td className={amountClassName(txn.balance)}>
                    {formatAmount(txn.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={3}>Summa</td>
                <td className="text-right amount">{formatAmount(account.totalDebit)}</td>
                <td className="text-right amount">{formatAmount(account.totalCredit)}</td>
                <td className={amountClassName(account.closingBalance)}>
                  {formatAmount(account.closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}
