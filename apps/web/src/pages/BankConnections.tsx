import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../context/LocaleContext";
import { defined } from "../utils/assert";
import { isBankingEnabledForOrganization } from "../utils/bank-feature-flag";
import { api, ApiError, type BankConnectionEntity, type BankSyncRunEntity } from "../api";

const STATUS_LABELS_KEYS: Record<BankConnectionEntity["status"], string> = {
  CONNECTED: "bank.connection.status.connected",
  AUTH_REQUIRED: "bank.connection.status.authRequired",
  SYNCING: "bank.connection.status.syncing",
  FAILED: "bank.connection.status.failed",
};

const STATUS_COLORS: Record<BankConnectionEntity["status"], string> = {
  CONNECTED: "#dff7e8",
  AUTH_REQUIRED: "#fff1d6",
  SYNCING: "#ddeeff",
  FAILED: "#ffe1e1",
};

const RUN_STATUS_LABELS_KEYS: Record<BankSyncRunEntity["status"], string> = {
  PENDING: "bank.run.status.pending",
  RUNNING: "bank.run.status.running",
  SUCCEEDED: "bank.run.status.succeeded",
  FAILED: "bank.run.status.failed",
};

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function connectionTitle(connection: BankConnectionEntity): string {
  return connection.displayName ?? connection.accountName ?? connection.externalConnectionId;
}

function latestSyncSummary(run: BankSyncRunEntity | undefined, t: (key: string) => string): string {
  if (!run) {
    return t("bank.info.noSyncRun");
  }

  const finishedAt = run.completedAt ?? run.startedAt;
  return `${t(RUN_STATUS_LABELS_KEYS[run.status] as never)} ${finishedAt ? `(${formatDateTime(finishedAt)})` : ""}`.trim();
}

export function BankConnections() {
  const { organization } = useOrganization();
  const { addToast } = useToast();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;
  const bankingEnabled = isBankingEnabledForOrganization(orgId);

  const connectionsQuery = useQuery({
    queryKey: ["bank-connections", orgId],
    queryFn: () => api.getBankConnections(orgId),
    enabled: bankingEnabled,
  });

  const connections = connectionsQuery.data?.data ?? [];

  const syncRunsQueries = useQueries({
    queries: connections.map((connection) => ({
      queryKey: ["bank-sync-runs", orgId, connection.id],
      queryFn: () => api.getBankSyncRuns(orgId, connection.id, 1),
      enabled: connections.length > 0,
    })),
  });

  const latestSyncRuns = new Map<string, BankSyncRunEntity | undefined>(
    connections.map((connection, index) => [
      connection.id,
      syncRunsQueries[index]?.data?.data?.[0],
    ]),
  );

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-connections", orgId] });
    queryClient.invalidateQueries({ queryKey: ["bank-sync-runs", orgId] });
  };

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) => api.syncBankConnection(orgId, connectionId),
    onSuccess: (response) => {
      refreshQueries();
      const toast = t("bank.toast.syncSuccess")
        .replace("{created}", String(response.data.created))
        .replace("{updated}", String(response.data.updated));
      addToast(toast, "success");
    },
    onError: (error: Error) => {
      addToast(error instanceof ApiError ? error.message : t("bank.toast.syncError"), "error");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (connectionId: string) => api.refreshBankConnectionAuth(orgId, connectionId),
    onSuccess: () => {
      refreshQueries();
      addToast(t("bank.toast.authRefreshed"), "success");
    },
    onError: (error: Error) => {
      addToast(
        error instanceof ApiError ? error.message : t("bank.toast.authRefreshError"),
        "error",
      );
    },
  });

  if (!bankingEnabled) {
    return (
      <div className="card">
        <h2>{t("bank.title")}</h2>
        <p className="text-muted">{t("bank.disabledMessage")}</p>
      </div>
    );
  }

  if (connectionsQuery.isLoading) {
    return <div className="loading">{t("bank.loadingConnections")}</div>;
  }

  if (connectionsQuery.error) {
    return (
      <div className="error">
        {t("bank.errorFetching")} {(connectionsQuery.error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-1">
        <div>
          <h2>{t("bank.title")}</h2>
          <p className="text-muted" style={{ marginTop: "0.35rem" }}>
            {t("bank.description")}
          </p>
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="card">
          <h3>{t("bank.noConnections")}</h3>
          <p className="text-muted">{t("bank.noConnectionsMessage")}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {connections.map((connection) => {
            const latestRun = latestSyncRuns.get(connection.id);
            const isSyncingThisConnection =
              syncMutation.isPending && syncMutation.variables === connection.id;
            const isRefreshingThisConnection =
              refreshMutation.isPending && refreshMutation.variables === connection.id;

            return (
              <section key={connection.id} className="card">
                <div className="flex-between" style={{ gap: "1rem", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ marginBottom: "0.35rem" }}>{connectionTitle(connection)}</h3>
                    <p className="text-muted" style={{ marginBottom: "0.5rem" }}>
                      Provider: {connection.provider} • Valuta: {connection.currency}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "999px",
                        background: STATUS_COLORS[connection.status],
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {t(STATUS_LABELS_KEYS[connection.status] as never)}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => syncMutation.mutate(connection.id)}
                      disabled={isSyncingThisConnection || isRefreshingThisConnection}
                    >
                      {isSyncingThisConnection
                        ? t("bank.action.syncing")
                        : t("bank.action.syncNow")}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => refreshMutation.mutate(connection.id)}
                      disabled={isSyncingThisConnection || isRefreshingThisConnection}
                    >
                      {isRefreshingThisConnection
                        ? t("bank.action.refreshingAuth")
                        : t("bank.action.refreshAuth")}
                    </button>
                    <Link
                      to={`/bank/${connection.id}/transactions`}
                      style={{ fontSize: "0.875rem", alignSelf: "center" }}
                    >
                      {t("bank.action.viewTransactions")}
                    </Link>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "0.75rem",
                    marginTop: "1rem",
                  }}
                >
                  <div>
                    <strong>{t("bank.info.lastSync")}</strong>
                    <div>{formatDateTime(connection.lastSyncedAt)}</div>
                  </div>
                  <div>
                    <strong>{t("bank.info.lastRun")}</strong>
                    <div>{latestSyncSummary(latestRun, t as (key: string) => string)}</div>
                  </div>
                  <div>
                    <strong>{t("bank.info.authExpires")}</strong>
                    <div>{formatDateTime(connection.authExpiresAt)}</div>
                  </div>
                  <div>
                    <strong>{t("bank.info.externalConnection")}</strong>
                    <div>{connection.externalConnectionId}</div>
                  </div>
                </div>

                {connection.lastErrorMessage && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.85rem 1rem",
                      borderRadius: "0.75rem",
                      background: "rgba(176, 33, 33, 0.08)",
                      border: "1px solid rgba(176, 33, 33, 0.16)",
                    }}
                  >
                    <strong>{t("bank.info.lastError")}</strong>
                    <div style={{ marginTop: "0.35rem" }}>
                      {connection.lastErrorCode ? `${connection.lastErrorCode}: ` : ""}
                      {connection.lastErrorMessage}
                    </div>
                  </div>
                )}

                {latestRun?.errorMessage && latestRun.status === "FAILED" && (
                  <p className="text-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                    {t("bank.info.syncFailed")} {latestRun.errorMessage}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
