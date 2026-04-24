import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../context/LocaleContext";
import { defined } from "../utils/assert";
import { isBankingEnabledForOrganization } from "../utils/bank-feature-flag";
import {
  ApiError,
  api,
  type BankMatchCandidate,
  type BankTransactionEntity,
  type BankTransactionMatchStatus,
} from "../api";

const MATCH_STATUS_LABELS_KEYS: Record<BankTransactionMatchStatus, string> = {
  PENDING_MATCH: "bank.status.pendingMatch",
  MATCHED: "bank.status.matched",
  CONFIRMED: "bank.status.confirmed",
  ERROR: "bank.status.error",
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
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;
  const bankingEnabled = isBankingEnabledForOrganization(orgId);

  const [page, setPage] = useState(1);
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [candidatePickerTx, setCandidatePickerTx] = useState<BankTransactionEntity | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [createVoucherTx, setCreateVoucherTx] = useState<BankTransactionEntity | null>(null);
  const [bankAccountNumber, setBankAccountNumber] = useState("1930");
  const [counterAccountNumber, setCounterAccountNumber] = useState("6110");
  const [voucherDescription, setVoucherDescription] = useState("");
  const [createVoucherError, setCreateVoucherError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      addToast(t("bank.toast.matched"), "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: (transactionId: string) => api.unmatchBankTransaction(orgId, transactionId),
    onSuccess: () => {
      invalidateTransactions();
      addToast(t("bank.toast.unmatched"), "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (transactionId: string) => api.confirmBankTransaction(orgId, transactionId),
    onSuccess: () => {
      invalidateTransactions();
      addToast(t("bank.toast.confirmed"), "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
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
      const toast = t("bank.toast.voucherCreated").replace(
        "{voucherNumber}",
        String(result.data.voucher.number),
      );
      closeCreateVoucherModal();
      addToast(toast, "success");
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
    },
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkConfirmBankTransactions(orgId, ids),
    onSuccess: (result) => {
      invalidateTransactions();
      setSelectedIds(new Set());
      addToast(
        t("bank.toast.bulkConfirmed").replace("{count}", String(result.data.updated)),
        "success",
      );
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
    },
  });

  const bulkUnmatchMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkUnmatchBankTransactions(orgId, ids),
    onSuccess: (result) => {
      invalidateTransactions();
      setSelectedIds(new Set());
      addToast(
        t("bank.toast.bulkUnmatched").replace("{count}", String(result.data.updated)),
        "success",
      );
    },
    onError: (error: Error) => {
      addToast(getErrorMessage(error, t("bank.error.generic")), "error");
    },
  });

  const handleFilterChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
      setSelectedIds(new Set());
    };

  const resetFilters = () => {
    setMatchStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const isBulkBusy = bulkConfirmMutation.isPending || bulkUnmatchMutation.isPending;

  const matchCandidates = matchCandidatesQuery.data?.data ?? [];
  useEffect(() => {
    if (matchCandidates.length > 0 && selectedCandidateId === "") {
      setSelectedCandidateId(matchCandidates[0]?.voucherId ?? "");
    }
  }, [matchCandidates, selectedCandidateId]);

  const selectedCandidate = matchCandidates.find(
    (candidate) => candidate.voucherId === selectedCandidateId,
  );

  const openCreateVoucherModal = (tx: BankTransactionEntity) => {
    setCreateVoucherTx(tx);
    setBankAccountNumber("1930");
    setCounterAccountNumber("6110");
    setVoucherDescription(`Banktransaktion: ${tx.description}`);
    setCreateVoucherError("");
  };

  const closeCreateVoucherModal = () => {
    setCreateVoucherTx(null);
    setCreateVoucherError("");
  };

  const submitCreateVoucher = () => {
    if (!createVoucherTx) return;

    const validAccount = /^\d{4}$/;
    if (!validAccount.test(bankAccountNumber) || !validAccount.test(counterAccountNumber)) {
      setCreateVoucherError(t("bank.createVoucher.invalidAccount"));
      return;
    }

    setCreateVoucherError("");
    createVoucherMutation.mutate({
      transactionId: createVoucherTx.id,
      bankAccountNumber,
      counterAccountNumber,
      description: voucherDescription.trim(),
    });
  };

  if (!bankingEnabled) {
    return (
      <div className="card">
        <h2>{t("bank.transactions")}</h2>
        <p className="text-muted">{t("bank.disabledMessage")}</p>
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="loading">{t("bank.loadingTransactions")}</div>;
  }

  if (query.error) {
    return (
      <div className="error">
        {t("bank.errorFetching")} {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-1">
        <div>
          <div style={{ marginBottom: "0.5rem" }}>
            <Link to="/bank" style={{ fontSize: "0.875rem" }}>
              {t("bank.backToConnections")}
            </Link>
          </div>
          <h2>{t("bank.transactions")}</h2>
          <p className="text-muted" style={{ marginTop: "0.35rem" }}>
            {t("bank.totalTransactions").replace("{total}", String(total))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            {t("bank.filterStatus")}
            <select
              value={matchStatus}
              onChange={handleFilterChange(setMatchStatus)}
              style={inputStyle}
            >
              <option value="">{t("bank.filterAll")}</option>
              {(
                Object.entries(MATCH_STATUS_LABELS_KEYS) as [BankTransactionMatchStatus, string][]
              ).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key as never)}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            {t("bank.filterFromDate")}
            <input
              type="date"
              value={fromDate}
              onChange={handleFilterChange(setFromDate)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            {t("bank.filterToDate")}
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
              {t("bank.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card">
          <p className="text-muted">{t("bank.noTransactionsFound")}</p>
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div
              className="card"
              style={{
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                {t("bank.bulk.selected").replace("{count}", String(selectedIds.size))}
              </span>
              <button
                style={smallButtonStyle}
                disabled={isBulkBusy}
                onClick={() => bulkConfirmMutation.mutate([...selectedIds])}
              >
                {bulkConfirmMutation.isPending
                  ? t("bank.action.confirming")
                  : t("bank.bulk.confirm")}
              </button>
              <button
                style={{
                  ...smallButtonStyle,
                  background: "transparent",
                  color: "inherit",
                  border: "1px solid #d1d5db",
                }}
                disabled={isBulkBusy}
                onClick={() => bulkUnmatchMutation.mutate([...selectedIds])}
              >
                {bulkUnmatchMutation.isPending
                  ? t("bank.action.unmatching")
                  : t("bank.bulk.unmatch")}
              </button>
              <button
                style={{
                  ...smallButtonStyle,
                  background: "transparent",
                  color: "inherit",
                  border: "1px solid #d1d5db",
                }}
                onClick={() => setSelectedIds(new Set())}
              >
                {t("bank.bulk.clearSelection")}
              </button>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ ...thStyle, width: "2.5rem" }}>
                    <input
                      type="checkbox"
                      checked={transactions.length > 0 && selectedIds.size === transactions.length}
                      onChange={toggleSelectAll}
                      aria-label={t("bank.bulk.selectAll")}
                      style={{ width: "1rem", height: "1rem" }}
                    />
                  </th>
                  <th style={thStyle}>{t("bank.table.date")}</th>
                  <th style={thStyle}>{t("bank.table.description")}</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>{t("bank.table.amount")}</th>
                  <th style={thStyle}>{t("bank.table.status")}</th>
                  <th style={thStyle}>{t("bank.table.actions")}</th>
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
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          aria-label={`${t("bank.bulk.selectTransaction")} ${tx.description}`}
                          style={{ width: "1rem", height: "1rem" }}
                        />
                      </td>
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
                          {t(
                            (MATCH_STATUS_LABELS_KEYS[tx.matchStatus] ??
                              "bank.status.error") as never,
                          )}
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
                            {isFindingMatch
                              ? t("bank.action.loading")
                              : t("bank.action.selectMatch")}
                          </button>
                          <button
                            style={smallButtonStyle}
                            disabled={
                              isBusy ||
                              (tx.matchStatus !== "MATCHED" && tx.matchStatus !== "CONFIRMED")
                            }
                            onClick={() => confirmMutation.mutate(tx.id)}
                          >
                            {isConfirming ? t("bank.action.confirming") : t("bank.action.confirm")}
                          </button>
                          <button
                            style={smallButtonStyle}
                            disabled={
                              isBusy ||
                              (tx.matchStatus !== "MATCHED" && tx.matchStatus !== "CONFIRMED")
                            }
                            onClick={() => unmatchMutation.mutate(tx.id)}
                          >
                            {isUnmatching ? t("bank.action.unmatching") : t("bank.action.unmatch")}
                          </button>
                          <button
                            style={{ ...smallButtonStyle, background: "#0f766e" }}
                            disabled={isBusy || tx.matchStatus === "CONFIRMED"}
                            onClick={() => openCreateVoucherModal(tx)}
                          >
                            {isCreatingVoucher
                              ? t("bank.action.creating")
                              : t("bank.action.createVoucher")}
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
                  <h3 style={{ margin: 0 }}>{t("bank.modal.title")}</h3>
                  <button
                    className="secondary"
                    onClick={() => {
                      setCandidatePickerTx(null);
                      setSelectedCandidateId("");
                    }}
                  >
                    {t("bank.modal.close")}
                  </button>
                </div>

                <p className="text-muted" style={{ marginTop: 0 }}>
                  {t("bank.modal.transaction")
                    .replace("{description}", candidatePickerTx.description)
                    .replace(
                      "{amount}",
                      formatAmount(candidatePickerTx.amountOre, candidatePickerTx.currency),
                    )}
                </p>

                {matchCandidatesQuery.isLoading ? (
                  <p className="text-muted">{t("bank.modal.loading")}</p>
                ) : matchCandidates.length === 0 ? (
                  <p className="text-muted">{t("bank.modal.noCandidates")}</p>
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
                            {t("bank.modal.candidate")
                              .replace("{voucherNumber}", String(candidate.voucherNumber))
                              .replace("{score}", String(candidate.score))}
                          </strong>
                        </div>
                        <div style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                          {candidate.description}
                        </div>
                        <div
                          className="text-muted"
                          style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}
                        >
                          {t("bank.modal.date").replace("{date}", formatDate(candidate.date))}
                        </div>
                        {candidate.reasons.length > 0 && (
                          <div
                            className="text-muted"
                            style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}
                          >
                            {t("bank.modal.reasons").replace(
                              "{reasons}",
                              candidate.reasons.join(", "),
                            )}
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
                    {applyMatchMutation.isPending
                      ? t("bank.modal.applying")
                      : t("bank.modal.apply")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createVoucherTx && (
            <div style={modalBackdropStyle}>
              <div className="card" style={modalCardStyle}>
                <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0 }}>{t("bank.createVoucher.title")}</h3>
                  <button className="secondary" onClick={closeCreateVoucherModal}>
                    {t("common.cancel")}
                  </button>
                </div>

                <p className="text-muted" style={{ marginTop: 0 }}>
                  {t("bank.createVoucher.transaction")
                    .replace("{description}", createVoucherTx.description)
                    .replace(
                      "{amount}",
                      formatAmount(createVoucherTx.amountOre, createVoucherTx.currency),
                    )}
                </p>

                <div style={{ display: "grid", gap: "0.65rem" }}>
                  <label style={labelStyle}>
                    {t("bank.createVoucher.bankAccount")}
                    <input
                      value={bankAccountNumber}
                      onChange={(event) => setBankAccountNumber(event.target.value)}
                      style={inputStyle}
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </label>

                  <label style={labelStyle}>
                    {t("bank.createVoucher.counterAccount")}
                    <input
                      value={counterAccountNumber}
                      onChange={(event) => setCounterAccountNumber(event.target.value)}
                      style={inputStyle}
                      inputMode="numeric"
                      maxLength={4}
                    />
                  </label>

                  <label style={labelStyle}>
                    {t("bank.createVoucher.description")}
                    <input
                      value={voucherDescription}
                      onChange={(event) => setVoucherDescription(event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  {createVoucherError && (
                    <p className="text-muted" style={{ color: "#b91c1c", margin: 0 }}>
                      {createVoucherError}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "0.85rem",
                    gap: "0.5rem",
                  }}
                >
                  <button className="secondary" onClick={closeCreateVoucherModal}>
                    {t("common.cancel")}
                  </button>
                  <button
                    style={buttonStyle}
                    disabled={createVoucherMutation.isPending}
                    onClick={submitCreateVoucher}
                  >
                    {createVoucherMutation.isPending
                      ? t("bank.createVoucher.submitting")
                      : t("bank.createVoucher.submit")}
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
                {t("bank.pagination.previous")}
              </button>
              <span style={{ fontSize: "0.875rem" }}>
                {t("bank.pagination.page")
                  .replace("{page}", String(page))
                  .replace("{totalPages}", String(totalPages))}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={buttonStyle}
              >
                {t("bank.pagination.next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getErrorMessage(error: Error, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return fallback;
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
