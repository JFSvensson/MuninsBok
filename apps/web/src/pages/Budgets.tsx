import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { oreToKronor } from "../utils/formatting";
import { api } from "../api";
import { useState } from "react";

export function Budgets() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const orgId = defined(organization).id;
  const fyId = defined(fiscalYear).id;

  const { data, isLoading } = useQuery({
    queryKey: ["budgets", orgId, fyId],
    queryFn: () => api.getBudgets(orgId, fyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (budgetId: string) => api.deleteBudget(orgId, budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      addToast("Budgeten har tagits bort", "success");
      setDeleteId(null);
    },
    onError: () => {
      addToast("Kunde inte ta bort budgeten", "error");
      setDeleteId(null);
    },
  });

  const budgets = data?.data ?? [];

  if (isLoading) {
    return <div className="loading">Laddar budgetar…</div>;
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Budget</h2>
        <button onClick={() => navigate("/budgets/new")}>+ Ny budget</button>
      </div>

      {budgets.length === 0 ? (
        <p style={{ color: "#666" }}>
          Inga budgetar för detta räkenskapsår. Skapa en budget för att jämföra utfall mot plan.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Namn</th>
              <th className="text-right">Rader</th>
              <th className="text-right">Totalt (kr)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((budget) => {
              const total = budget.entries.reduce((sum, e) => sum + e.amount, 0);
              const isDeleting = deleteId === budget.id;

              return (
                <tr key={budget.id}>
                  <td>
                    <Link to={`/budgets/${budget.id}/edit`}>{budget.name}</Link>
                  </td>
                  <td className="text-right">{budget.entries.length}</td>
                  <td className="text-right">{oreToKronor(total).toLocaleString("sv-SE")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem" }}
                      onClick={() => navigate(`/budgets/${budget.id}/vs-actual`)}
                    >
                      Utfall
                    </button>
                    <button
                      className="secondary"
                      style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem" }}
                      onClick={() => navigate(`/budgets/${budget.id}/edit`)}
                    >
                      Redigera
                    </button>
                    {isDeleting ? (
                      <>
                        <span style={{ marginRight: "0.5rem", color: "#c62828" }}>Ta bort?</span>
                        <button
                          style={{ padding: "0.25rem 0.5rem", marginRight: "0.25rem" }}
                          onClick={() => deleteMutation.mutate(budget.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Ja
                        </button>
                        <button
                          className="secondary"
                          style={{ padding: "0.25rem 0.5rem" }}
                          onClick={() => setDeleteId(null)}
                        >
                          Nej
                        </button>
                      </>
                    ) : (
                      <button
                        className="secondary"
                        style={{ padding: "0.25rem 0.5rem", color: "#c62828" }}
                        onClick={() => setDeleteId(budget.id)}
                      >
                        Ta bort
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
