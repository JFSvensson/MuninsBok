import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { oreToKronor } from "../utils/formatting";
import { api } from "../api";
import { useState } from "react";

export function VoucherTemplates() {
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const orgId = defined(organization).id;

  const { data, isLoading } = useQuery({
    queryKey: ["voucher-templates", orgId],
    queryFn: () => api.getVoucherTemplates(orgId),
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => api.deleteVoucherTemplate(orgId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      addToast("Mallen har tagits bort", "success");
      setDeleteId(null);
    },
    onError: () => {
      addToast("Kunde inte ta bort mallen", "error");
      setDeleteId(null);
    },
  });

  const templates = data?.data ?? [];

  if (isLoading) {
    return <div className="loading">Laddar mallar…</div>;
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Verifikatmallar</h2>
        <button onClick={() => navigate("/templates/new")}>+ Ny mall</button>
      </div>

      {templates.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          Inga mallar ännu. Skapa en mall för att snabbt fylla i återkommande verifikat.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Namn</th>
              <th scope="col">Beskrivning</th>
              <th scope="col" className="text-right">
                Rader
              </th>
              <th scope="col" className="text-right">
                Belopp (kr)
              </th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => {
              const totalDebit = tpl.lines.reduce((sum, l) => sum + l.debit, 0);
              const isDeleting = deleteId === tpl.id;

              return (
                <tr key={tpl.id}>
                  <td>
                    <Link to={`/templates/${tpl.id}/edit`}>{tpl.name}</Link>
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{tpl.description || "—"}</td>
                  <td className="text-right">{tpl.lines.length}</td>
                  <td className="text-right">{oreToKronor(totalDebit).toLocaleString("sv-SE")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem" }}
                      onClick={() => navigate(`/templates/${tpl.id}/edit`)}
                    >
                      Redigera
                    </button>
                    {isDeleting ? (
                      <>
                        <span style={{ marginRight: "0.5rem", color: "var(--color-negative)" }}>
                          Ta bort?
                        </span>
                        <button
                          style={{ padding: "0.25rem 0.5rem", marginRight: "0.25rem" }}
                          onClick={() => deleteMutation.mutate(tpl.id)}
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
                        style={{ padding: "0.25rem 0.5rem", color: "var(--color-negative)" }}
                        onClick={() => setDeleteId(tpl.id)}
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
