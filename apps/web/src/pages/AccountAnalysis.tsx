import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { Account, AccountAnalysis as AccountAnalysisData } from "../api";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { DateFilter, type DateRange } from "../components/DateFilter";
import { formatAmount, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

// ── Helpers ─────────────────────────────────────────────────

function barWidth(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / max) * 100));
}

// ── Component ───────────────────────────────────────────────

export function AccountAnalysis() {
  const { organization, fiscalYear } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedAccount, setSelectedAccount] = useState("");

  // Fetch all accounts for the selector
  const { data: accountsRes } = useQuery({
    queryKey: ["accounts", organization?.id],
    queryFn: () => api.getAccounts(defined(organization).id, false),
    enabled: !!organization,
  });

  const accounts: Account[] = accountsRes?.data ?? [];

  // Fetch analysis when account is selected
  const { data, isLoading, error } = useQuery({
    queryKey: ["account-analysis", organization?.id, fiscalYear?.id, selectedAccount, dateRange],
    queryFn: () =>
      api.getAccountAnalysis(
        defined(organization).id,
        defined(fiscalYear).id,
        selectedAccount,
        dateRange,
      ),
    enabled: !!organization && !!fiscalYear && selectedAccount !== "",
  });

  const report: AccountAnalysisData | undefined = data?.data;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Kontoanalys</h2>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {report && report.months.length > 0 && (
            <>
              <button
                className="secondary"
                onClick={() => {
                  const rows = report.months.map((m) => [
                    m.label,
                    csvAmount(m.debit),
                    csvAmount(m.credit),
                    csvAmount(m.net),
                    csvAmount(m.balance),
                    String(m.transactionCount),
                  ]);
                  rows.push([
                    "Totalt",
                    csvAmount(report.totalDebit),
                    csvAmount(report.totalCredit),
                    csvAmount(report.closingBalance),
                    "",
                    String(report.totalTransactions),
                  ]);
                  const csv = toCsv(
                    ["Månad", "Debet", "Kredit", "Netto", "Saldo", "Transaktioner"],
                    rows,
                  );
                  downloadCsv(csv, `kontoanalys-${report.accountNumber}.csv`);
                }}
              >
                Exportera CSV
              </button>
              <button className="secondary" onClick={() => window.print()}>
                Skriv ut
              </button>
            </>
          )}
        </div>
      </div>

      {/* Account selector */}
      <div className="flex gap-1 items-center mb-2" style={{ flexWrap: "wrap" }}>
        <label htmlFor="account-select" style={{ fontSize: "0.9rem", whiteSpace: "nowrap" }}>
          Konto:
        </label>
        <select
          id="account-select"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          style={{ minWidth: "280px" }}
        >
          <option value="">— Välj konto —</option>
          {accounts.map((a) => (
            <option key={a.number} value={a.number}>
              {a.number} – {a.name}
            </option>
          ))}
        </select>

        <DateFilter onFilter={setDateRange} />
      </div>

      {!selectedAccount && <div className="empty">Välj ett konto ovan för att visa analysen.</div>}

      {selectedAccount && isLoading && <div className="loading">Laddar kontoanalys…</div>}

      {selectedAccount && error && (
        <div className="error">Fel vid hämtning: {(error as Error).message}</div>
      )}

      {report && report.months.length === 0 && (
        <div className="empty">
          Inga transaktioner hittades för konto {report.accountNumber} i vald period.
        </div>
      )}

      {report && report.months.length > 0 && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ background: "#f0f9f0", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Total debet</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#2e7d32" }}>
                {formatAmount(report.totalDebit)}
              </div>
            </div>
            <div style={{ background: "#fef0f0", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Total kredit</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#c62828" }}>
                {formatAmount(report.totalCredit)}
              </div>
            </div>
            <div style={{ background: "#f0f4ff", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Slutsaldo</div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  color: report.closingBalance >= 0 ? "#2e7d32" : "#c62828",
                }}
              >
                {formatAmount(report.closingBalance)}
              </div>
            </div>
            <div style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Transaktioner</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                {report.totalTransactions}
              </div>
            </div>
            <div style={{ background: "#f5f0ff", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Snitt netto/mån</div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  color: report.averageMonthlyNet >= 0 ? "#2e7d32" : "#c62828",
                }}
              >
                {formatAmount(report.averageMonthlyNet)}
              </div>
            </div>
            <div style={{ background: "#fffde7", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Högsta netto</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#2e7d32" }}>
                {formatAmount(report.highestMonthlyNet)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#888" }}>{report.highestMonthLabel}</div>
            </div>
            <div style={{ background: "#fff3e0", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>Lägsta netto</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#c62828" }}>
                {formatAmount(report.lowestMonthlyNet)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#888" }}>{report.lowestMonthLabel}</div>
            </div>
          </div>

          {/* Balance trend (CSS bar chart) */}
          <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>Saldo över tid</h3>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "4px",
              height: "160px",
              padding: "0.5rem 0",
              borderBottom: "2px solid #ccc",
              marginBottom: "0.25rem",
            }}
          >
            {(() => {
              const maxBal = Math.max(...report.months.map((m) => Math.abs(m.balance)), 1);
              return report.months.map((m) => {
                const pct = Math.round((Math.abs(m.balance) / maxBal) * 100);
                const isNeg = m.balance < 0;
                return (
                  <div
                    key={m.month}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "48px",
                        height: `${Math.max(pct, 2)}%`,
                        background: isNeg ? "#ef5350" : "#4caf50",
                        borderRadius: "3px 3px 0 0",
                        minHeight: "2px",
                      }}
                      title={`${m.label}: ${formatAmount(m.balance)} kr`}
                    />
                  </div>
                );
              });
            })()}
          </div>
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginBottom: "1.5rem",
            }}
          >
            {report.months.map((m) => (
              <div
                key={m.month}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: "0.7rem",
                  color: "#888",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Monthly detail table */}
          <h3 style={{ marginBottom: "0.5rem" }}>Månadsvis uppdelning</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Månad</th>
                  <th className="text-right">Debet</th>
                  <th className="text-right">Kredit</th>
                  <th className="text-right">Netto</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Ant.</th>
                  <th style={{ width: "18%" }}>Fördelning</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxAbs = Math.max(
                    ...report.months.map((m) => Math.max(Math.abs(m.debit), Math.abs(m.credit))),
                    1,
                  );
                  return report.months.map((m) => (
                    <tr key={m.month}>
                      <td>
                        <strong>{m.label}</strong>
                      </td>
                      <td className={`text-right ${amountClassName(m.debit)}`}>
                        {formatAmount(m.debit)}
                      </td>
                      <td className={`text-right ${amountClassName(-m.credit)}`}>
                        {formatAmount(m.credit)}
                      </td>
                      <td className={`text-right ${amountClassName(m.net)}`}>
                        {formatAmount(m.net)}
                      </td>
                      <td className={`text-right ${amountClassName(m.balance)}`}>
                        {formatAmount(m.balance)}
                      </td>
                      <td className="text-right">{m.transactionCount}</td>
                      <td>
                        <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                          <div
                            style={{
                              height: "14px",
                              width: `${barWidth(m.debit, maxAbs)}%`,
                              background: "#4caf50",
                              borderRadius: "2px",
                              minWidth: m.debit !== 0 ? "2px" : "0",
                            }}
                            title={`Debet: ${formatAmount(m.debit)}`}
                          />
                          <div
                            style={{
                              height: "14px",
                              width: `${barWidth(m.credit, maxAbs)}%`,
                              background: "#ef5350",
                              borderRadius: "2px",
                              minWidth: m.credit !== 0 ? "2px" : "0",
                            }}
                            title={`Kredit: ${formatAmount(m.credit)}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                  <td>Totalt</td>
                  <td className={`text-right ${amountClassName(report.totalDebit)}`}>
                    {formatAmount(report.totalDebit)}
                  </td>
                  <td className={`text-right ${amountClassName(-report.totalCredit)}`}>
                    {formatAmount(report.totalCredit)}
                  </td>
                  <td className={`text-right ${amountClassName(report.closingBalance)}`}>
                    {formatAmount(report.closingBalance)}
                  </td>
                  <td></td>
                  <td className="text-right">{report.totalTransactions}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
