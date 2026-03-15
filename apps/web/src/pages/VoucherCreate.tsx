import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { useVoucherForm } from "../hooks/useVoucherForm";
import { ApiError, api } from "../api";
import { formatAmount } from "../utils/formatting";

const OCR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function formatOreAmount(ore: number | undefined): string {
  if (ore == null) return "-";
  return `${formatAmount(ore / 100)} kr`;
}

function getOcrErrorMessage(error: Error): string {
  if (error instanceof ApiError && error.code === "OCR_PDF_DISABLED") {
    return "PDF-OCR ar avstangt pa servern. Behorig admin kan aktivera OCR_ENABLE_PDF=true i API-miljon.";
  }
  return error.message;
}

export function VoucherCreate() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);

  const orgId = defined(organization).id;

  const {
    date,
    setDate,
    description,
    setDescription,
    createdBy,
    setCreatedBy,
    lines,
    error,
    updateLine,
    addLine,
    removeLine,
    totalDebit,
    totalCredit,
    isBalanced,
    canSubmit,
    submit,
    loadTemplate,
    applyReceiptAnalysis,
    isPending,
  } = useVoucherForm({
    organizationId: orgId,
    fiscalYearId: fiscalYear?.id ?? "",
    onSuccess: () => navigate("/vouchers"),
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", orgId],
    queryFn: () => api.getAccounts(orgId),
    enabled: !!organization,
  });

  const { data: templatesData } = useQuery({
    queryKey: ["voucher-templates", orgId],
    queryFn: () => api.getVoucherTemplates(orgId),
    enabled: !!organization,
  });

  const { data: ocrStatusData } = useQuery({
    queryKey: ["receipt-ocr-status", orgId],
    queryFn: () => api.getReceiptOcrStatus(orgId),
    enabled: !!organization,
  });

  const accounts = accountsData?.data ?? [];
  const templates = templatesData?.data ?? [];
  const ocrStatus = ocrStatusData?.data;
  const pdfStatusLabel = ocrStatus == null ? "okand" : ocrStatus.pdfEnabled ? "aktiv" : "inaktiv";

  const receiptMutation = useMutation({
    mutationFn: (file: File) => api.analyzeReceipt(orgId, file),
    onSuccess: () => {
      setReceiptError(null);
      setReceiptNotice("Kvittot ar tolkat. Kontrollera OCR-forslaget innan du bokfor.");
    },
    onError: (error: Error) => {
      setReceiptNotice(null);
      setReceiptError(getOcrErrorMessage(error));
    },
  });

  const receiptAnalysis = receiptMutation.data?.data;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleReceiptAnalyze = () => {
    if (!receiptFile) {
      setReceiptError("Valj en kvittofil i JPG-, PNG-, WebP- eller PDF-format for OCR.");
      return;
    }

    setReceiptNotice(null);
    setReceiptError(null);
    receiptMutation.mutate(receiptFile);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Nytt verifikat</h2>
        {templates.length > 0 && (
          <select
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) loadTemplate(tpl);
              e.target.value = "";
            }}
            defaultValue=""
            style={{ maxWidth: "250px" }}
          >
            <option value="" disabled>
              Fyll i från mall…
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <section className="info-box mb-2">
        <div className="flex justify-between items-center gap-2" style={{ flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Kvitto-tolkning (OCR)</h3>
            <p className="text-muted" style={{ margin: "0.35rem 0 0" }}>
              Ladda upp en kvittofil for att fa forslag pa datum, beskrivning och belopp.
            </p>
            <p className="text-muted" style={{ margin: "0.35rem 0 0" }}>
              PDF-OCR: {pdfStatusLabel}
            </p>
          </div>
          <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
            <input
              ref={receiptFileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && !OCR_ALLOWED_TYPES.includes(file.type)) {
                  setReceiptFile(null);
                  setReceiptNotice(null);
                  setReceiptError("OCR stodjer just nu JPG, PNG, WebP och PDF.");
                  return;
                }

                setReceiptFile(file);
                setReceiptNotice(null);
                setReceiptError(null);
              }}
              disabled={receiptMutation.isPending}
            />
            <button
              type="button"
              onClick={handleReceiptAnalyze}
              disabled={receiptMutation.isPending}
            >
              {receiptMutation.isPending ? "Tolkar..." : "Tolka kvitto"}
            </button>
          </div>
        </div>

        {receiptFile && (
          <p className="text-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            Vald fil: {receiptFile.name}
          </p>
        )}
        {receiptNotice && <div style={{ marginTop: "0.75rem" }}>{receiptNotice}</div>}
        {receiptError && <div className="error mt-1">{receiptError}</div>}

        {receiptAnalysis && (
          <div style={{ marginTop: "1rem" }}>
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              <div>
                <strong>Butik/leverantor:</strong> {receiptAnalysis.merchantName ?? "-"}
              </div>
              <div>
                <strong>Datum:</strong> {receiptAnalysis.transactionDate ?? "-"}
              </div>
              <div>
                <strong>Total:</strong> {formatOreAmount(receiptAnalysis.totalAmountOre)}
              </div>
              <div>
                <strong>Moms:</strong> {formatOreAmount(receiptAnalysis.vatAmountOre)}
              </div>
              <div>
                <strong>OCR-sakerhet:</strong> {receiptAnalysis.confidence}%
              </div>
            </div>

            <div className="mt-1">
              <strong>Foreslagen beskrivning:</strong> {receiptAnalysis.suggestedDescription}
            </div>

            {receiptAnalysis.warnings.length > 0 && (
              <div className="mt-1">
                {receiptAnalysis.warnings.map((warning) => (
                  <div key={warning} className="text-muted">
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1 mt-1" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  applyReceiptAnalysis(receiptAnalysis);
                  setReceiptNotice(
                    "OCR-forslaget ar infogat i formularet. Valj konton och kontrollera uppgifterna.",
                  );
                }}
              >
                Anvand forslaget i verifikatet
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  receiptMutation.reset();
                  setReceiptFile(null);
                  setReceiptError(null);
                  setReceiptNotice(null);
                  if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
                }}
              >
                Rensa OCR-resultat
              </button>
            </div>

            <details className="mt-1">
              <summary>Visa utlasa text</summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginTop: "0.75rem",
                  fontSize: "0.9rem",
                }}
              >
                {receiptAnalysis.extractedText}
              </pre>
            </details>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 mb-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="date">Datum</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="description">Beskrivning</label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Kontantförsäljning"
              required
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="createdBy">Signatur</label>
            <input
              id="createdBy"
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="Valfri"
              maxLength={100}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th scope="col">Konto</th>
              <th scope="col" className="text-right">
                Debet
              </th>
              <th scope="col" className="text-right">
                Kredit
              </th>
              <th scope="col">Beskrivning</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={line.accountNumber}
                    onChange={(e) => updateLine(index, "accountNumber", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">Välj konto</option>
                    {accounts.map((account) => (
                      <option key={account.number} value={account.number}>
                        {account.number} {account.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.debit}
                    onChange={(e) => updateLine(index, "debit", e.target.value)}
                    placeholder="0,00"
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.credit}
                    onChange={(e) => updateLine(index, "credit", e.target.value)}
                    placeholder="0,00"
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    placeholder="Valfri"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 2}
                    style={{ padding: "0.25rem 0.5rem" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <button type="button" className="secondary" onClick={addLine}>
                  + Lägg till rad
                </button>
              </td>
              <td className="text-right amount">
                <strong>{formatAmount(totalDebit)}</strong>
              </td>
              <td className="text-right amount">
                <strong>{formatAmount(totalCredit)}</strong>
              </td>
              <td colSpan={2}>
                {!isBalanced && (
                  <span style={{ color: "var(--color-negative)" }}>
                    Differens: {formatAmount(totalDebit - totalCredit)}
                  </span>
                )}
                {isBalanced && totalDebit > 0 && (
                  <span style={{ color: "var(--color-positive)" }}>✓ Balanserar</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between items-center" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={() => navigate("/vouchers")}>
            Avbryt
          </button>
          <button type="submit" disabled={!canSubmit}>
            {isPending ? "Sparar..." : "Spara verifikat"}
          </button>
        </div>
      </form>
    </div>
  );
}
