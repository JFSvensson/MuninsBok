import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { api, type FiscalYear } from "../api";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE");
}

export function FiscalYears() {
  const { organization, fiscalYears, setFiscalYear } = useOrganization();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [openingBalanceTarget, setOpeningBalanceTarget] = useState<{
    fyId: string;
    previousFyId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: (fyId: string) => api.closeFiscalYear(organization!.id, fyId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fiscalYears", organization!.id] });
      setFiscalYear(data.data);
      setConfirmClose(null);
      setClosingId(null);
      setError(null);
      addToast("Räkenskapsåret har stängts. Ett bokslutsverifikat har skapats.");
    },
    onError: (err: Error) => {
      setError(err.message);
      setClosingId(null);
    },
  });

  const openingMutation = useMutation({
    mutationFn: ({ fyId, previousFyId }: { fyId: string; previousFyId: string }) =>
      api.createOpeningBalances(organization!.id, fyId, previousFyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscalYears", organization!.id] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      setOpeningBalanceTarget(null);
      setError(null);
      addToast("Ingående balanser har skapats som ett verifikat.");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (!organization) return null;

  // Sort: newest first
  const sorted = [...fiscalYears].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  // Find the latest closed FY (for opening balance source)
  const closedFys = sorted.filter((fy) => fy.isClosed);

  const handleCloseClick = (fyId: string) => {
    setError(null);
    setConfirmClose(fyId);
  };

  const handleConfirmClose = () => {
    if (!confirmClose) return;
    setClosingId(confirmClose);
    closeMutation.mutate(confirmClose);
  };

  const handleOpeningBalances = (fy: FiscalYear) => {
    // Find the previous closed FY (most recent closed before this FY's start)
    const prevClosed = closedFys.find(
      (c) => new Date(c.endDate).getTime() < new Date(fy.startDate).getTime(),
    );
    if (prevClosed) {
      setError(null);
      setOpeningBalanceTarget({ fyId: fy.id, previousFyId: prevClosed.id });
    }
  };

  return (
    <div>
      <h2>Räkenskapsår</h2>
      <p className="text-muted mb-2">
        Hantera räkenskapsår för {organization.name}. Stäng ett avslutat år för att skapa
        bokslutsverifikat och föra över balanser.
      </p>

      {error && <div className="error mb-1">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Status</th>
            <th>Åtgärder</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((fy) => {
            const startYear = new Date(fy.startDate).getFullYear();
            const endYear = new Date(fy.endDate).getFullYear();
            const label = startYear === endYear ? `${startYear}` : `${startYear}/${endYear}`;

            // Can only create opening balances if there's a previous closed FY
            const prevClosed = closedFys.find(
              (c) => new Date(c.endDate).getTime() < new Date(fy.startDate).getTime(),
            );
            const canCreateOpening = !fy.isClosed && !!prevClosed;

            return (
              <tr key={fy.id}>
                <td>
                  <strong>{label}</strong>
                  <br />
                  <span className="text-muted" style={{ fontSize: "0.85em" }}>
                    {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
                  </span>
                </td>
                <td>
                  {fy.isClosed ? (
                    <span className="badge badge-closed">Stängt</span>
                  ) : (
                    <span className="badge badge-open">Öppet</span>
                  )}
                </td>
                <td>
                  {!fy.isClosed && (
                    <button
                      className="btn-sm btn-danger"
                      onClick={() => handleCloseClick(fy.id)}
                      disabled={closingId === fy.id}
                    >
                      {closingId === fy.id ? "Stänger..." : "Stäng år"}
                    </button>
                  )}
                  {canCreateOpening && (
                    <button
                      className="btn-sm secondary ml-1"
                      onClick={() => handleOpeningBalances(fy)}
                      disabled={openingMutation.isPending}
                    >
                      Skapa IB
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", padding: "2rem" }}>
                Inga räkenskapsår finns. Skapa ett med <strong>+</strong> bredvid
                räkenskapsår-listan.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* BFL close explanation */}
      <details className="mt-2" style={{ maxWidth: 600 }}>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>
          Vad händer när jag stänger ett räkenskapsår?
        </summary>
        <div style={{ marginTop: "0.5rem", color: "#555", lineHeight: 1.6 }}>
          <p>
            Enligt <strong>BFL 6 kap. 2–3 §§</strong> ska bokslutet upprättas senast sex månader
            efter räkenskapsårets slut. När du stänger året:
          </p>
          <ol>
            <li>
              Ett <strong>bokslutsverifikat</strong> skapas automatiskt som nollställer
              resultatkonton (3000–8999) mot konto 2099 (Årets resultat).
            </li>
            <li>
              Räkenskapsåret markeras som stängt — verifikat kan inte längre ändras eller raderas.
            </li>
            <li>
              Du kan sedan skapa <strong>ingående balanser (IB)</strong> för nästa räkenskapsår.
            </li>
          </ol>
        </div>
      </details>

      {/* Confirm close dialog */}
      {confirmClose && (
        <div className="dialog-overlay" onClick={() => setConfirmClose(null)}>
          <div className="dialog dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Stäng räkenskapsår?</h3>
              <button className="btn-icon" onClick={() => setConfirmClose(null)} type="button">
                ×
              </button>
            </div>
            <p className="dialog-description">
              Detta skapar ett bokslutsverifikat och låser alla verifikat i året. Åtgärden kan inte
              ångras.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setConfirmClose(null)}>
                Avbryt
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmClose}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? "Stänger..." : "Stäng året"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm opening balances dialog */}
      {openingBalanceTarget && (
        <div className="dialog-overlay" onClick={() => setOpeningBalanceTarget(null)}>
          <div className="dialog dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Skapa ingående balanser?</h3>
              <button
                className="btn-icon"
                onClick={() => setOpeningBalanceTarget(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="dialog-description">
              Balansposter (konton 1000–2999) från det stängda räkenskapsåret överförs som ingående
              balanser till det valda året.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setOpeningBalanceTarget(null)}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => openingMutation.mutate(openingBalanceTarget)}
                disabled={openingMutation.isPending}
              >
                {openingMutation.isPending ? "Skapar..." : "Skapa IB"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
