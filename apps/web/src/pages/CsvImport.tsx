import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api, type CsvImportPreview } from "../api";
import { formatAmount, formatDate } from "../utils/formatting";
import styles from "./CsvImport.module.css";

type Step = "upload" | "mapping" | "preview" | "result";

interface ImportResultData {
  vouchersCreated: number;
  errors: string[];
}

export function CsvImport() {
  const { organization, fiscalYear } = useOrganization();
  const orgId = defined(organization).id;
  const fyId = defined(fiscalYear).id;

  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [bankAccount, setBankAccount] = useState("1930");
  const [defaultAccount, setDefaultAccount] = useState("3000");
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", orgId],
    queryFn: () => api.getAccounts(orgId),
  });
  const accounts = accountsData?.data ?? [];

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      const text = await file.text();
      setCsvText(text);

      try {
        const res = await api.parseCsv(orgId, text);
        setHeaders(res.data.headers);
        setSampleRows(res.data.sampleRows);

        // Auto-detect common column names
        const lowerHeaders = res.data.headers.map((h) => h.toLowerCase());
        const dateIdx = lowerHeaders.findIndex(
          (h) => h.includes("datum") || h.includes("date") || h.includes("bokföringsdag"),
        );
        const descIdx = lowerHeaders.findIndex(
          (h) =>
            h.includes("text") ||
            h.includes("beskrivning") ||
            h.includes("meddelande") ||
            h.includes("mottagare"),
        );
        const amtIdx = lowerHeaders.findIndex(
          (h) => h.includes("belopp") || h.includes("amount") || h.includes("summa"),
        );

        if (dateIdx >= 0) setDateCol(dateIdx);
        if (descIdx >= 0) setDescCol(descIdx);
        if (amtIdx >= 0) setAmountCol(amtIdx);

        setStep("mapping");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunde inte tolka CSV-filen");
      }
    },
    [orgId],
  );

  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewCsvImport(orgId, csvText, {
        dateColumn: dateCol,
        descriptionColumn: descCol,
        amountColumn: amountCol,
      }),
    onSuccess: (data) => {
      setPreview(data.data);
      setError(null);
      setStep("preview");
    },
    onError: (err: Error) => setError(err.message),
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Ingen förhandsvisning");
      return api.executeCsvImport(orgId, {
        fiscalYearId: fyId,
        bankAccountNumber: bankAccount,
        defaultAccountNumber: defaultAccount,
        transactions: preview.rows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: Math.round(r.amount * 100), // kronor → öre
        })),
      });
    },
    onSuccess: (data) => {
      setImportResult(data.data);
      setError(null);
      setStep("result");
    },
    onError: (err: Error) => setError(err.message),
  });

  const reset = () => {
    setStep("upload");
    setCsvText("");
    setHeaders([]);
    setSampleRows([]);
    setPreview(null);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="card">
      <h2>Importera bankutdrag (CSV)</h2>

      {/* Stepper */}
      <div className={styles.stepper}>
        {(["upload", "mapping", "preview", "result"] as Step[]).map((s, i) => (
          <span key={s} className={`${styles.step} ${step === s ? styles.stepActive : ""}`}>
            {i + 1}.{" "}
            {s === "upload"
              ? "Fil"
              : s === "mapping"
                ? "Kolumner"
                : s === "preview"
                  ? "Förhandsvisning"
                  : "Klart"}
          </span>
        ))}
      </div>

      {error && <div className="error mb-2">{error}</div>}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className={styles.section}>
          <p className="mb-2">
            Ladda upp en CSV-fil från din bank (t.ex. SEB, Swedbank, Nordea, Handelsbanken).
          </p>
          <input
            type="file"
            accept=".csv,.txt,.tsv"
            onChange={handleFile}
            data-testid="csv-file-input"
          />
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === "mapping" && (
        <div className={styles.section}>
          <h3>Välj kolumner</h3>
          <p className="mb-2">Ange vilka kolumner som innehåller datum, beskrivning och belopp.</p>

          <div className={styles.mappingGrid}>
            <label>
              Datum:
              <select value={dateCol} onChange={(e) => setDateCol(Number(e.target.value))}>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Beskrivning:
              <select value={descCol} onChange={(e) => setDescCol(Number(e.target.value))}>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Belopp:
              <select value={amountCol} onChange={(e) => setAmountCol(Number(e.target.value))}>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sampleRows.length > 0 && (
            <>
              <h4 className="mt-2">Förhandsvisning av data</h4>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className={
                            i === dateCol || i === descCol || i === amountCol
                              ? styles.selectedCol
                              : ""
                          }
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((val, ci) => (
                          <td
                            key={ci}
                            className={
                              ci === dateCol || ci === descCol || ci === amountCol
                                ? styles.selectedCol
                                : ""
                            }
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button type="button" className="secondary" onClick={reset}>
              Tillbaka
            </button>
            <button
              type="button"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? "Bearbetar…" : "Förhandsgranska"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && preview && (
        <div className={styles.section}>
          <h3>Förhandsvisning</h3>
          <p className="mb-2">
            {preview.rows.length} transaktioner tolkades.
            {preview.errors.length > 0 && (
              <span className="negative"> {preview.errors.length} rader kunde inte tolkas.</span>
            )}
          </p>

          {preview.errors.length > 0 && (
            <details className="mb-2">
              <summary>Visa fel ({preview.errors.length})</summary>
              <ul>
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    Rad {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className={styles.accountSelect}>
            <label>
              Bankkonto:
              <select value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}>
                {accounts
                  .filter((a) => a.type === "ASSET")
                  .map((a) => (
                    <option key={a.number} value={a.number}>
                      {a.number} — {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Standardmotkonto:
              <select value={defaultAccount} onChange={(e) => setDefaultAccount(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} — {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Beskrivning</th>
                  <th className="text-right">Belopp</th>
                  <th>Typ</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{formatDate(row.date)}</td>
                    <td>{row.description}</td>
                    <td className={`text-right ${row.amount >= 0 ? "positive" : "negative"}`}>
                      {formatAmount(row.amount)}
                    </td>
                    <td>{row.amount >= 0 ? "Inkomst" : "Utgift"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button type="button" className="secondary" onClick={() => setStep("mapping")}>
              Tillbaka
            </button>
            <button
              type="button"
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending || preview.rows.length === 0}
            >
              {executeMutation.isPending
                ? "Importerar…"
                : `Importera ${preview.rows.length} verifikat`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === "result" && importResult && (
        <div className={styles.section}>
          <h3>Import klar</h3>
          <p className="positive mb-2">{importResult.vouchersCreated} verifikat skapades.</p>
          {importResult.errors.length > 0 && (
            <details className="mb-2">
              <summary className="negative">{importResult.errors.length} fel uppstod</summary>
              <ul>
                {importResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          <div className={styles.actions}>
            <button type="button" onClick={reset}>
              Importera fler
            </button>
            <a href="/vouchers" className={styles.link}>
              Visa verifikat →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
