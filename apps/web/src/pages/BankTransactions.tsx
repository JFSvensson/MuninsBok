import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { isBankingEnabledForOrganization } from "../utils/bank-feature-flag";
import {
  ApiError,
  api,
  type BankMatchCandidate,
  type BankTransactionEntity,
  type BankTransactionMatchStatus,
} from "../api";

const MATCH_STATUS_LABELS: Record<BankTransactionMatchStatus, string> = {
  PENDING_MATCH: "Väntar på matchning",
  MATCHED: "Matchad",
  CONFIRMED: "Bekräftad",
  ERROR: "Fel",
};

const MATCH_STATUS_COLORS: Record<BankTransactionMatchStatus, string> = {
  PENDING_MATCH: "#fef3c7",
  MATCHED: "#dff7e8",
  CONFIRMED: "#dbeafe",
  ERROR: "#ffe1e1",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short" }).format(parsed);
}

function formatAmount(amountOre: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountOre / 100);
}

const PAGE_SIZE = 20;

export function BankTransactions() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { organization } = useOrganization();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;
  const bankingEnabled = isBankingEnabledForOrganization(orgId);

  const [page, setPage] = useState(1);
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [candidatePickerTx, setCandidatePickerTx] = useState<BankTransactionEntity | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  const query = useQuery({
    queryKey: [
      "bank-transactions",
      orgId,
      connectionId,
      page,
      PAGE_SIZE,
      matchStatus,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      api.getBankTransactions(orgId, defined(connectionId), {
        page,
        limit: PAGE_SIZE,
        ...(matchStatus && { matchStatus }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
      }),
    enabled: !!connectionId && bankingEnabled,
  });

  const result = query.data;
  const transactions: BankTransactionEntity[] = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-transactions", orgId, connectionId] });
  };

  const matchCandidatesQuery = useQuery({
    queryKey: ["bank-match-candidates", orgId, candidatePickerTx?.id],
    queryFn: () => api.getBankMatchCandidates(orgId, defined(candidatePickerTx).id, 10),
    enabled: candidatePickerTx != null,
  });

  const applyMatchMutation = useMutation({
    mutationFn: (vars: { transactionId: string; candidate: BankMatchCandidate }) =>
      api.matchBankTransaction(orgId, vars.transactionId, {
        voucherId: vars.candidate.voucherId,
        matchConfidence: vars.candidate.score,
        matchNote:
          vars.candidate.reasons.length > 0
            ? `Manuell match: ${vars.candidate.reasons.join(", ")}`
            : "Manuell match utan explicita skäl",
      }),
    onSuccess: () => {
      invalidateTransactions();
      setCandidatePickerTx(null);
      setSelectedCandidateId("");
      addToast("Transaktionen matchades", "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error), "error");
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: (transactionId: string) => api.unmatchBankTransaction(orgId, transactionId),
    onSuccess: () => {
      invalidateTransactions();
      addToast("Matchningen togs bort", "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error), "error");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (transactionId: string) => api.confirmBankTransaction(orgId, transactionId),
    onSuccess: () => {
      invalidateTransactions();
      addToast("Transaktionen bekräftades", "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error), "error");
    },
  });

  const createVoucherMutation = useMutation({
    mutationFn: (vars: {
      transactionId: string;
      bankAccountNumber: string;
      counterAccountNumber: string;
      description?: string;
    }) =>
      api.createVoucherFromBankTransaction(orgId, vars.transactionId, {
        bankAccountNumber: vars.bankAccountNumber,
        counterAccountNumber: vars.counterAccountNumber,
        ...(vars.description != null && { description: vars.description }),
      }),
    onSuccess: (result) => {
      invalidateTransactions();
      addToast(
        `Verifikat #${result.data.voucher.number} skapades och transaktionen bekräftades`,
        "success",
      );
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error), "error");
    },
  });

  const handleFilterChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  const resetFilters = () => {
    setMatchStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const matchCandidates = matchCandidatesQuery.data?.data ?? [];
  useEffect(() => {
    if (matchCandidates.length > 0 && selectedCandidateId === "") {
      setSelectedCandidateId(matchCandidates[0]?.voucherId ?? "");
    }
  }, [matchCandidates, selectedCandidateId]);

  const selectedCandidate = matchCandidates.find(
    (candidate) => candidate.voucherId === selectedCandidateId,
  );

  if (!bankingEnabled) {
    return (
      <div className="card">
        <h2>Transaktioner</h2>
        <p className="text-muted">
          Bankfunktioner är inte aktiverade för den valda organisationen.
        </p>
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="loading">Laddar transaktioner...</div>;
  }

  if (query.error) {
    return <div className="error">Fel vid hämtning: {(query.error as Error).message}</div>;
  }

  return (
    <div>
      <div className="flex-between mb-1">
        <div>
          <div style={{ marginBottom: "0.5rem" }}>
            <Link to="/bank" style={{ fontSize: "0.875rem" }}>
              ← Bankkopplingar
            </Link>
          </div>
          <h2>Transaktioner</h2>
          <p className="text-muted" style={{ marginTop: "0.35rem" }}>
            {total} transaktioner totalt
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            Matchningsstatus
            <select
              value={matchStatus}
              onChange={handleFilterChange(setMatchStatus)}
              style={inputStyle}
            >
              <option value="">Alla</option>
              {(Object.entries(MATCH_STATUS_LABELS) as [BankTransactionMatchStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label style={labelStyle}>
            Från datum
            <input
              type="date"
              value={fromDate}
              onChange={handleFilterChange(setFromDate)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Till datum
            <input
              type="date"
              value={toDate}
              onChange={handleFilterChange(setToDate)}
              style={inputStyle}
            />
          </label>

          {(matchStatus || fromDate || toDate) && (
            <button
              onClick={resetFilters}
              style={{
                ...buttonStyle,
                background: "transparent",
                color: "inherit",
                border: "1px solid #d1d5db",
              }}
            >
              Rensa filter
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card">
          <p className="text-muted">Inga transaktioner hittades med valda filter.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Beskrivning</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Belopp</th>
                  <th style={thStyle}>Matchningsstatus</th>
                  <th style={thStyle}>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isFindingMatch =
                    matchCandidatesQuery.isFetching && candidatePickerTx?.id === tx.id;
                  const isUnmatching =
                    unmatchMutation.isPending && unmatchMutation.variables === tx.id;
                  const isConfirming =
                    confirmMutation.isPending && confirmMutation.variables === tx.id;
                  const isApplyingMatch =
                    applyMatchMutation.isPending &&
                    applyMatchMutation.variables?.transactionId === tx.id;
                  const isCreatingVoucher =
                    createVoucherMutation.isPending &&
                    createVoucherMutation.variables?.transactionId === tx.id;
                  const isBusy =
                    isFindingMatch ||
                    isUnmatching ||
                    isConfirming ||
                    isApplyingMatch ||
                    isCreatingVoucher;

                  return (
                    <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={tdStyle}>{formatDate(tx.bookedAt)}</td>
                      <td style={tdStyle}>
                        <div>{tx.description}</div>
                        {tx.counterpartyName && (
                          <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                            {tx.counterpartyName}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span style={{ color: tx.amountOre < 0 ? "#dc2626" : "#16a34a" }}>
                          {formatAmount(tx.amountOre, tx.currency)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            background: MATCH_STATUS_COLORS[tx.matchStatus] ?? "#f3f4f6",
                          }}
                        >
                          {MATCH_STATUS_LABELS[tx.matchStatus] ?? tx.matchStatus}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          <button
                            style={smallButtonStyle}
                            disabled={isBusy || tx.matchStatus === "CONFIRMED"}
                            onClick={() => {
                              setCandidatePickerTx(tx);
                              setSelectedCandidateId("");
                            }}
                          >
                            {isFindingMatch ? "Laddar..." : "Välj match"}
                          </button>
                          <button
                            style={smallButtonStyle}
                            disabled={
                              isBusy ||
                              (tx.matchStatus !== "MATCHED" && tx.matchStatus !== "CONFIRMED")
                            }
                            onClick={() => confirmMutation.mutate(tx.id)}
                          >
                            {isConfirming ? "Bekräftar..." : "Bekräfta"}
                          </button>
                          <button
                            style={smallButtonStyle}
                            disabled={
                              isBusy ||
                              (tx.matchStatus !== "MATCHED" && tx.matchStatus !== "CONFIRMED")
                            }
                            onClick={() => unmatchMutation.mutate(tx.id)}
                          >
                            {isUnmatching ? "Tar bort..." : "Avmatcha"}
                          </button>
                          <button
                            style={{ ...smallButtonStyle, background: "#0f766e" }}
                            disabled={isBusy || tx.matchStatus === "CONFIRMED"}
                            onClick={() => {
                              const counterAccountNumber = window.prompt(
                                "Motkonto (4 siffror), t.ex. 6071",
                                "6071",
                              );
                              if (!counterAccountNumber) return;

                              const bankAccountNumber = window.prompt(
                                "Bankkonto (4 siffror), t.ex. 1930",
                                "1930",
                              );
                              if (!bankAccountNumber) return;

                              createVoucherMutation.mutate({
                                transactionId: tx.id,
                                bankAccountNumber,
                                counterAccountNumber,
                                description: `Banktransaktion: ${tx.description}`,
                              });
                            }}
                          >
                            {isCreatingVoucher ? "Skapar..." : "Skapa verifikat"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {candidatePickerTx && (
            <div style={modalBackdropStyle}>
              <div className="card" style={modalCardStyle}>
                <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0 }}>Välj matchning</h3>
                  <button
                    className="secondary"
                    onClick={() => {
                      setCandidatePickerTx(null);
                      setSelectedCandidateId("");
                    }}
                  >
                    Stäng
                  </button>
                </div>

                <p className="text-muted" style={{ marginTop: 0 }}>
                  Transaktion: {candidatePickerTx.description} (
                  {formatAmount(candidatePickerTx.amountOre, candidatePickerTx.currency)})
                </p>

                {matchCandidatesQuery.isLoading ? (
                  <p className="text-muted">Hämtar matchningskandidater...</p>
                ) : matchCandidates.length === 0 ? (
                  <p className="text-muted">Inga kandidater hittades för transaktionen.</p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.5rem",
                      maxHeight: "320px",
                      overflowY: "auto",
                    }}
                  >
                    {matchCandidates.map((candidate) => (
                      <label
                        key={candidate.voucherId}
                        style={{
                          display: "block",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "0.6rem",
                          cursor: "pointer",
                          background:
                            selectedCandidateId === candidate.voucherId ? "#eff6ff" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input
                            type="radio"
                            name="match-candidate"
                            checked={selectedCandidateId === candidate.voucherId}
                            onChange={() => setSelectedCandidateId(candidate.voucherId)}
                          />
                          <strong>
                            Verifikat #{candidate.voucherNumber} - score {candidate.score}
                          </strong>
                        </div>
                        <div style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                          {candidate.description}
                        </div>
                        <div
                          className="text-muted"
                          style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}
                        >
                          Datum: {formatDate(candidate.date)}
                        </div>
                        {candidate.reasons.length > 0 && (
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}
                          >
                            Skäl: {candidate.reasons.join(", ")}
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "0.85rem",
                    gap: "0.5rem",
                  }}
                >
                  <button
                    style={buttonStyle}
                    disabled={!selectedCandidate || applyMatchMutation.isPending}
                    onClick={() => {
                      if (!candidatePickerTx || !selectedCandidate) {
                        return;
                      }
                      applyMatchMutation.mutate({
                        transactionId: candidatePickerTx.id,
                        candidate: selectedCandidate,
                      });
                    }}
                  >
                    {applyMatchMutation.isPending ? "Matchar..." : "Matcha vald kandidat"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                marginTop: "1rem",
                justifyContent: "center",
              }}
            >
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={buttonStyle}>
                Föregående
              </button>
              <span style={{ fontSize: "0.875rem" }}>
                Sida {page} av {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={buttonStyle}
              >
                Nästa
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Något gick fel. Försök igen.";
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.875rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: "4px",
  border: "1px solid #d1d5db",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  borderRadius: "4px",
  border: "none",
  background: "#374151",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.875rem",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "0.25rem 0.55rem",
  borderRadius: "4px",
  border: "none",
  background: "#374151",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.75rem",
};

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  color: "#374151",
};

const tdStyle: React.CSSProperties = {
  padding: "0.625rem 0.75rem",
  verticalAlign: "top",
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 40,
  padding: "1rem",
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "640px",
  maxHeight: "80vh",
  overflow: "auto",
};
