import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError, type BankConnectionEntity, type BankSyncRunEntity } from "../api";

const STATUS_LABELS: Record<BankConnectionEntity["status"], string> = {
  CONNECTED: "Ansluten",
  AUTH_REQUIRED: "Kräver återanslutning",
  SYNCING: "Synkar",
  FAILED: "Fel",
};

const STATUS_COLORS: Record<BankConnectionEntity["status"], string> = {
  CONNECTED: "#dff7e8",
  AUTH_REQUIRED: "#fff1d6",
  SYNCING: "#ddeeff",
  FAILED: "#ffe1e1",
};

const RUN_STATUS_LABELS: Record<BankSyncRunEntity["status"], string> = {
  PENDING: "Väntar",
  RUNNING: "Kör",
  SUCCEEDED: "Lyckades",
  FAILED: "Misslyckades",
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

function latestSyncSummary(run?: BankSyncRunEntity): string {
  if (!run) {
    return "Ingen synkkörning registrerad ännu";
  }

  const finishedAt = run.completedAt ?? run.startedAt;
  return `${RUN_STATUS_LABELS[run.status]} ${finishedAt ? `(${formatDateTime(finishedAt)})` : ""}`.trim();
}

export function BankConnections() {
  const { organization } = useOrganization();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const connectionsQuery = useQuery({
    queryKey: ["bank-connections", orgId],
    queryFn: () => api.getBankConnections(orgId),
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
      addToast(
        `Synk klar. ${response.data.created} nya och ${response.data.updated} uppdaterade transaktioner.`,
        "success",
      );
    },
    onError: (error: Error) => {
      addToast(error instanceof ApiError ? error.message : "Kunde inte starta synk", "error");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (connectionId: string) => api.refreshBankConnectionAuth(orgId, connectionId),
    onSuccess: () => {
      refreshQueries();
      addToast("Bankautentisering förnyades", "success");
    },
    onError: (error: Error) => {
      addToast(
        error instanceof ApiError ? error.message : "Kunde inte förnya bankautentisering",
        "error",
      );
    },
  });

  if (connectionsQuery.isLoading) {
    return <div className="loading">Laddar bankanslutningar...</div>;
  }

  if (connectionsQuery.error) {
    return (
      <div className="error">Fel vid hämtning: {(connectionsQuery.error as Error).message}</div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-1">
        <div>
          <h2>Bankkopplingar</h2>
          <p className="text-muted" style={{ marginTop: "0.35rem" }}>
            Översikt över anslutningar, senaste synk och eventuella autentiseringsproblem.
          </p>
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="card">
          <h3>Inga bankkopplingar ännu</h3>
          <p className="text-muted">
            När en bank har anslutits via API-flödet visas status, senaste synk och fel här.
          </p>
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
                      {STATUS_LABELS[connection.status]}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => syncMutation.mutate(connection.id)}
                      disabled={isSyncingThisConnection || isRefreshingThisConnection}
                    >
                      {isSyncingThisConnection ? "Synkar..." : "Synka nu"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => refreshMutation.mutate(connection.id)}
                      disabled={isSyncingThisConnection || isRefreshingThisConnection}
                    >
                      {isRefreshingThisConnection ? "Förnyar..." : "Förnya auth"}
                    </button>
                    <Link
                      to={`/bank/${connection.id}/transactions`}
                      style={{ fontSize: "0.875rem", alignSelf: "center" }}
                    >
                      Visa transaktioner →
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
                    <strong>Senaste synk</strong>
                    <div>{formatDateTime(connection.lastSyncedAt)}</div>
                  </div>
                  <div>
                    <strong>Senaste körning</strong>
                    <div>{latestSyncSummary(latestRun)}</div>
                  </div>
                  <div>
                    <strong>Auth giltig till</strong>
                    <div>{formatDateTime(connection.authExpiresAt)}</div>
                  </div>
                  <div>
                    <strong>Extern anslutning</strong>
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
                    <strong>Senaste fel</strong>
                    <div style={{ marginTop: "0.35rem" }}>
                      {connection.lastErrorCode ? `${connection.lastErrorCode}: ` : ""}
                      {connection.lastErrorMessage}
                    </div>
                  </div>
                )}

                {latestRun?.errorMessage && latestRun.status === "FAILED" && (
                  <p className="text-muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                    Senaste synkkörning misslyckades: {latestRun.errorMessage}
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
