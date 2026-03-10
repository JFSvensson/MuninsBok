import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import type { FiscalYear } from "../api";
import { formatAmount, amountClassName, formatDate } from "../utils/formatting";
import dialogStyles from "../components/Dialog.module.css";

export function ResultDisposition() {
  const { organization, fiscalYears } = useOrganization();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!organization) return null;

  const sorted = [...fiscalYears].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  const closedFys = sorted.filter((fy) => fy.isClosed);
  const openFys = sorted.filter((fy) => !fy.isClosed);

  // Default: most recent closed FY as source
  const [selectedClosedId, setSelectedClosedId] = useState<string | null>(null);
  const closedFyId = selectedClosedId ?? closedFys[0]?.id;
  const closedFy = closedFys.find((fy) => fy.id === closedFyId);

  // Automatically find the next open FY (first open FY that starts after the closed one ends)
  const targetFy = closedFy
    ? openFys.find((fy) => new Date(fy.startDate).getTime() >= new Date(closedFy.endDate).getTime())
    : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["disposition-preview", organization.id, closedFyId, targetFy?.id],
    queryFn: () =>
      api.getDispositionPreview(organization.id, defined(closedFyId), defined(targetFy).id),
    enabled: !!closedFyId && !!targetFy,
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      api.executeDisposition(organization.id, defined(targetFy).id, defined(closedFyId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disposition-preview"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["year-end-summary"] });
      setConfirmOpen(false);
      addToast("Resultatdisposition har genomförts. Verifikat skapat i mottagande räkenskapsår.");
    },
    onError: (err: Error) => {
      addToast(err.message, "error");
    },
  });

  const preview = data?.data;

  if (closedFys.length === 0) {
    return (
      <div className="card">
        <h2>Resultatdisposition</h2>
        <p className="empty">
          Inga stängda räkenskapsår finns. Stäng ett räkenskapsår först för att kunna disponera
          resultatet.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Resultatdisposition</h2>
      <p className="text-muted mb-2">
        Överför årets resultat (konto 2099) till balanserat resultat (konto 2091) i det mottagande
        räkenskapsåret.
      </p>

      {/* Source fiscal year selector */}
      {closedFys.length > 1 && (
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="closed-fy-select" style={{ marginRight: "0.5rem" }}>
            Stängt räkenskapsår:
          </label>
          <select
            id="closed-fy-select"
            value={closedFyId ?? ""}
            onChange={(e) => setSelectedClosedId(e.target.value)}
          >
            {closedFys.map((fy: FiscalYear) => (
              <option key={fy.id} value={fy.id}>
                {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      {closedFy && (
        <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          Källa: {formatDate(closedFy.startDate)} – {formatDate(closedFy.endDate)}
        </p>
      )}

      {!targetFy && closedFy && (
        <div className="error mb-1">
          Inget öppet räkenskapsår hittades som mottagare. Skapa ett nytt räkenskapsår som i
          ordningsföljd följer det stängda året.
        </div>
      )}

      {targetFy && (
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Mottagare: {formatDate(targetFy.startDate)} – {formatDate(targetFy.endDate)}
        </p>
      )}

      {isLoading && <p className="loading">Laddar förhandsvisning…</p>}
      {error && (
        <p className="error">Kunde inte ladda förhandsvisning: {(error as Error).message}</p>
      )}

      {preview && (
        <>
          {/* Net result summary */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "8px",
              border: `1px solid ${preview.netResult >= 0 ? "var(--color-positive)" : "var(--color-negative)"}`,
              background: preview.netResult >= 0 ? "#f1f8e9" : "#fef2f2",
              marginBottom: "1.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}
            >
              Årets resultat
            </div>
            <div
              style={{ fontSize: "1.5rem", fontWeight: 700 }}
              className={preview.netResult >= 0 ? "positive" : "negative"}
            >
              {formatAmount(preview.netResult)}
            </div>
          </div>

          {/* Disposition lines */}
          <table>
            <thead>
              <tr>
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
              {preview.lines.map((line) => (
                <tr key={line.accountNumber}>
                  <td>{line.accountNumber}</td>
                  <td>{line.accountName}</td>
                  <td className={line.debit ? amountClassName(line.debit) : "text-right"}>
                    {line.debit ? formatAmount(line.debit) : ""}
                  </td>
                  <td className={line.credit ? amountClassName(line.credit) : "text-right"}>
                    {line.credit ? formatAmount(line.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Balance check */}
          <p style={{ marginTop: "0.5rem" }}>
            Balanskontroll:{" "}
            {preview.isBalanced ? (
              <span style={{ color: "var(--color-positive)", fontWeight: 600 }}>
                ✓ Verifikatet balanserar
              </span>
            ) : (
              <span style={{ color: "var(--color-negative)", fontWeight: 600 }}>✗ Obalans</span>
            )}
          </p>

          {/* Action */}
          <div style={{ marginTop: "1.5rem" }}>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={executeMutation.isPending || !preview.isBalanced}
            >
              Genomför resultatdisposition
            </button>
          </div>
        </>
      )}

      {/* BFL explanation */}
      <details className="mt-2" style={{ maxWidth: 600 }}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>
          Vad är resultatdisposition?
        </summary>
        <div style={{ marginTop: "0.5rem", color: "var(--color-text-subtle)", lineHeight: 1.6 }}>
          <p>
            Resultatdisposition innebär att årets resultat (vinst eller förlust) på konto{" "}
            <strong>2099 (Årets resultat)</strong> överförs till konto{" "}
            <strong>2091 (Balanserat resultat)</strong>.
          </p>
          <p>
            Detta sker normalt efter att räkenskapsåret stängts och bokslutsverifikatet skapats.
            Verifikatet bokförs i det nya (mottagande) räkenskapsåret.
          </p>
        </div>
      </details>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className={dialogStyles.overlay} onClick={() => setConfirmOpen(false)}>
          <div className={dialogStyles.dialogSm} onClick={(e) => e.stopPropagation()}>
            <div className={dialogStyles.header}>
              <h3>Bekräfta resultatdisposition</h3>
              <button className="btn-icon" onClick={() => setConfirmOpen(false)} type="button">
                ×
              </button>
            </div>
            <p className={dialogStyles.description}>
              Ett verifikat skapas i räkenskapsåret{" "}
              {targetFy && `${formatDate(targetFy.startDate)} – ${formatDate(targetFy.endDate)}`}{" "}
              som överför {preview && formatAmount(Math.abs(preview.netResult))} från konto 2099
              till 2091.
            </p>
            <div className={dialogStyles.actions}>
              <button type="button" className="secondary" onClick={() => setConfirmOpen(false)}>
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? "Genomför..." : "Genomför"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
