import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import type { ClosingPreviewResponse, FiscalYear } from "../api";
import { formatAmount, amountClassName, formatDate } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";
import { exportYearEndClosingPdf } from "../utils/pdf";
import dialogStyles from "../components/Dialog.module.css";
import styles from "./YearEndClosing.module.css";

type SectionData = ClosingPreviewResponse["revenues"];

function SectionTable({ section }: { section: SectionData }) {
  if (section.lines.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3>{section.title}</h3>
      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Kontonamn</th>
            <th className="text-right">Saldo</th>
            <th className="text-right">Debet</th>
            <th className="text-right">Kredit</th>
          </tr>
        </thead>
        <tbody>
          {section.lines.map((line) => (
            <tr key={line.accountNumber}>
              <td>{line.accountNumber}</td>
              <td>{line.accountName}</td>
              <td className={amountClassName(line.currentBalance)}>
                {formatAmount(line.currentBalance)}
              </td>
              <td className="text-right amount">
                {line.closingDebit ? formatAmount(line.closingDebit) : ""}
              </td>
              <td className="text-right amount">
                {line.closingCredit ? formatAmount(line.closingCredit) : ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <strong>Summa</strong>
            </td>
            <td className={amountClassName(section.total)}>
              <strong>{formatAmount(section.total)}</strong>
            </td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function YearEndClosing() {
  const { organization, fiscalYear, fiscalYears } = useOrganization();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFyId, setSelectedFyId] = useState<string | null>(null);

  // Use the selected or context fiscal year
  const openFiscalYears = (fiscalYears ?? []).filter((fy: FiscalYear) => !fy.isClosed);
  const activeFyId = selectedFyId ?? fiscalYear?.id ?? openFiscalYears[0]?.id;
  const activeFy = (fiscalYears ?? []).find((fy: FiscalYear) => fy.id === activeFyId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["closing-preview", organization?.id, activeFyId],
    queryFn: () => api.getClosingPreview(defined(organization).id, defined(activeFyId)),
    enabled: !!organization && !!activeFyId,
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closeFiscalYear(defined(organization).id, defined(activeFyId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-years"] });
      queryClient.invalidateQueries({ queryKey: ["closing-preview"] });
      addToast("Räkenskapsåret har stängts");
      setConfirmOpen(false);
    },
    onError: () => {
      addToast("Kunde inte stänga räkenskapsåret", "error");
    },
  });

  const preview = data?.data;

  function handleExportCsv() {
    if (!preview) return;
    const headers = ["Konto", "Kontonamn", "Saldo", "Debet (bokslut)", "Kredit (bokslut)"];
    const rows: string[][] = [];

    for (const section of [
      preview.revenues,
      preview.expenses,
      preview.financialIncome,
      preview.financialExpenses,
    ]) {
      if (section.lines.length === 0) continue;
      rows.push([section.title, "", "", "", ""]);
      for (const line of section.lines) {
        rows.push([
          line.accountNumber,
          line.accountName,
          csvAmount(line.currentBalance),
          line.closingDebit ? csvAmount(line.closingDebit) : "",
          line.closingCredit ? csvAmount(line.closingCredit) : "",
        ]);
      }
      rows.push(["Summa", "", csvAmount(section.total), "", ""]);
      rows.push(["", "", "", "", ""]);
    }

    // Result entry
    rows.push([
      "Resultat → 2099",
      preview.resultEntry.accountName,
      "",
      csvAmount(preview.resultEntry.debit),
      csvAmount(preview.resultEntry.credit),
    ]);
    rows.push(["", "", "", "", ""]);
    rows.push(["Nettoresultat", "", csvAmount(preview.netResult), "", ""]);

    downloadCsv(toCsv(headers, rows), "bokslut-forhandsvisning.csv");
  }

  // --- Render ---

  if (!organization) return <div className="empty">Välj en organisation</div>;
  if (openFiscalYears.length === 0 && !activeFy) {
    return (
      <div className="card">
        <h2>Boksluts-förhandsvisning</h2>
        <p className="empty">Inga öppna räkenskapsår att förhandsgranska.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Boksluts-förhandsvisning</h2>
        <div className="flex" style={{ gap: "0.5rem" }}>
          {preview?.hasEntries && (
            <>
              <button className="secondary" onClick={handleExportCsv}>
                Exportera CSV
              </button>
              <button
                className="secondary"
                onClick={() =>
                  exportYearEndClosingPdf(
                    preview,
                    organization.name,
                    activeFy
                      ? formatDate(activeFy.startDate) + " – " + formatDate(activeFy.endDate)
                      : "",
                  )
                }
              >
                Exportera PDF
              </button>
              <button className="secondary" onClick={() => window.print()}>
                Skriv ut
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fiscal year selector */}
      {openFiscalYears.length > 1 && (
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="fy-select" style={{ marginRight: "0.5rem" }}>
            Räkenskapsår:
          </label>
          <select
            id="fy-select"
            value={activeFyId ?? ""}
            onChange={(e) => setSelectedFyId(e.target.value)}
          >
            {openFiscalYears.map((fy: FiscalYear) => (
              <option key={fy.id} value={fy.id}>
                {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeFy && (
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Räkenskapsår: {formatDate(activeFy.startDate)} – {formatDate(activeFy.endDate)}
        </p>
      )}

      {isLoading && <p className="loading">Laddar förhandsvisning…</p>}
      {error && <p className="error">Kunde inte ladda förhandsvisning</p>}

      {preview && !preview.hasEntries && (
        <div className={styles.noEntries}>
          <p>Inga resultaträkningskonton att stänga för detta räkenskapsår.</p>
        </div>
      )}

      {preview && preview.hasEntries && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h3>Intäkter</h3>
              <div className={`value positive`}>{formatAmount(preview.totalRevenues)}</div>
            </div>
            <div className={styles.summaryCard}>
              <h3>Kostnader</h3>
              <div className={`value negative`}>{formatAmount(preview.totalExpenses)}</div>
            </div>
            <div className={styles.summaryCard}>
              <h3>Rörelseresultat</h3>
              <div className={`value ${preview.operatingResult >= 0 ? "positive" : "negative"}`}>
                {formatAmount(preview.operatingResult)}
              </div>
            </div>
            {(preview.totalFinancialIncome !== 0 || preview.totalFinancialExpenses !== 0) && (
              <div className={styles.summaryCard}>
                <h3>Finansnetto</h3>
                <div
                  className={`value ${preview.totalFinancialIncome - preview.totalFinancialExpenses >= 0 ? "positive" : "negative"}`}
                >
                  {formatAmount(preview.totalFinancialIncome - preview.totalFinancialExpenses)}
                </div>
              </div>
            )}
            <div
              className={`${styles.summaryCard} ${preview.netResult >= 0 ? styles.profitResult : styles.lossResult}`}
            >
              <h3>Årets resultat</h3>
              <div className={`value ${preview.netResult >= 0 ? "positive" : "negative"}`}>
                {formatAmount(preview.netResult)}
              </div>
            </div>
          </div>

          {/* Closing entry sections */}
          <SectionTable section={preview.revenues} />
          <SectionTable section={preview.expenses} />
          <SectionTable section={preview.financialIncome} />
          <SectionTable section={preview.financialExpenses} />

          {/* Result entry */}
          <div className={styles.section}>
            <h3>Resultatbokning (2099 Årets resultat)</h3>
            <table>
              <thead>
                <tr>
                  <th>Konto</th>
                  <th>Kontonamn</th>
                  <th className="text-right">Debet</th>
                  <th className="text-right">Kredit</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.resultRow}>
                  <td>{preview.resultEntry.accountNumber}</td>
                  <td>{preview.resultEntry.accountName}</td>
                  <td className="text-right amount">
                    {preview.resultEntry.debit ? formatAmount(preview.resultEntry.debit) : ""}
                  </td>
                  <td className="text-right amount">
                    {preview.resultEntry.credit ? formatAmount(preview.resultEntry.credit) : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance check */}
          <p>
            Balanskontroll:{" "}
            {preview.isBalanced ? (
              <span className={styles.balanceOk}>✓ Bokslutsverifikatet balanserar</span>
            ) : (
              <span className={styles.balanceError}>✗ Obalans i bokslutsverifikatet</span>
            )}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {preview.accountCount} resultaträkningskonton berörs
          </p>

          {/* Close action */}
          <div className={styles.actions}>
            <button onClick={() => setConfirmOpen(true)} disabled={closeMutation.isPending}>
              Stäng räkenskapsåret
            </button>
          </div>
        </>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className={dialogStyles.overlay} onClick={() => setConfirmOpen(false)}>
          <div className={dialogStyles.dialogSm} onClick={(e) => e.stopPropagation()}>
            <h3 className={dialogStyles.header}>Bekräfta årsbokslut</h3>
            <p className={dialogStyles.description}>
              Detta skapar ett bokslutsverifikat som nollställer alla resultaträkningskonton mot
              konto 2099 (Årets resultat) och markerar räkenskapsåret som stängt.
            </p>
            <p className={dialogStyles.description}>
              <strong>OBS:</strong> Åtgärden kan inte ångras. Verifikat i ett stängt räkenskapsår
              kan inte ändras.
            </p>
            {preview && (
              <p className={dialogStyles.description}>
                Årets resultat:{" "}
                <strong className={preview.netResult >= 0 ? "positive" : "negative"}>
                  {formatAmount(preview.netResult)} kr
                </strong>{" "}
                ({preview.netResult >= 0 ? "vinst" : "förlust"})
              </p>
            )}
            <div className={dialogStyles.actions}>
              <button className="secondary" onClick={() => setConfirmOpen(false)}>
                Avbryt
              </button>
              <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                {closeMutation.isPending ? "Stänger…" : "Stäng året"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
