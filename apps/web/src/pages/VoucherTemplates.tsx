import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../context/LocaleContext";
import { defined } from "../utils/assert";
import { oreToKronor } from "../utils/formatting";
import { api } from "../api";
import { useState } from "react";

export function VoucherTemplates() {
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLocale();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showExecute, setShowExecute] = useState(false);
  const [executeFyId, setExecuteFyId] = useState("");

  const orgId = defined(organization).id;

  const { data, isLoading } = useQuery({
    queryKey: ["voucher-templates", orgId],
    queryFn: () => api.getVoucherTemplates(orgId),
  });

  const { data: dueData } = useQuery({
    queryKey: ["recurring-due", orgId],
    queryFn: () => api.getDueRecurringTemplates(orgId),
  });

  const { data: fiscalYearsData } = useQuery({
    queryKey: ["fiscal-years", orgId],
    queryFn: () => api.getFiscalYears(orgId),
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => api.deleteVoucherTemplate(orgId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      addToast(t("templates.deleted"), "success");
      setDeleteId(null);
    },
    onError: () => {
      addToast(t("templates.deleteError"), "error");
      setDeleteId(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => api.executeRecurringTemplates(orgId, executeFyId),
    onSuccess: (result) => {
      const d = result.data;
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-due"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      addToast(`${d.vouchersCreated} ${t("templates.vouchersCreated")}`, "success");
      if (d.errors.length > 0) {
        addToast(`${d.errors.length} ${t("templates.executeErrors")}`, "error");
      }
      setShowExecute(false);
    },
    onError: () => addToast(t("templates.executeError"), "error"),
  });

  const templates = data?.data ?? [];
  const dueCount = dueData?.data?.length ?? 0;
  const fiscalYears = fiscalYearsData?.data ?? [];

  if (isLoading) {
    return <div className="loading">{t("common.loading")}</div>;
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>{t("templates.title")}</h2>
        <div className="flex gap-1">
          {dueCount > 0 && (
            <button className="secondary" onClick={() => setShowExecute(!showExecute)}>
              {t("templates.recurring.execute")} ({dueCount})
            </button>
          )}
          <button onClick={() => navigate("/templates/new")}>{t("templates.new")}</button>
        </div>
      </div>

      {showExecute && dueCount > 0 && (
        <div
          className="card"
          style={{ marginBottom: "1rem", background: "var(--color-surface-alt)" }}
        >
          <p>
            <strong>{dueCount}</strong> {t("templates.recurring.due")}
          </p>
          <div className="flex gap-1 items-center">
            <select
              value={executeFyId}
              onChange={(e) => setExecuteFyId(e.target.value)}
              style={{ maxWidth: "20rem" }}
            >
              <option value="">{t("templates.recurring.selectFy")}</option>
              {fiscalYears
                .filter((fy) => !fy.isClosed)
                .map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.startDate.slice(0, 10)} — {fy.endDate.slice(0, 10)}
                  </option>
                ))}
            </select>
            <button
              onClick={() => executeMutation.mutate()}
              disabled={!executeFyId || executeMutation.isPending}
            >
              {executeMutation.isPending
                ? t("templates.recurring.running")
                : t("templates.recurring.run")}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{t("templates.empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t("templates.name")}</th>
              <th scope="col">{t("templates.description")}</th>
              <th scope="col">{t("templates.schedule")}</th>
              <th scope="col" className="text-right">
                {t("templates.lines")}
              </th>
              <th scope="col" className="text-right">
                {t("templates.amount")}
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
                  <td style={{ color: "var(--color-text-muted)" }}>
                    {tpl.isRecurring
                      ? `${tpl.frequency === "QUARTERLY" ? t("templates.recurring.quarterLabel") : t("templates.recurring.monthLabel")}, ${t("templates.recurring.dayOfMonth").toLowerCase()} ${tpl.dayOfMonth}`
                      : "—"}
                  </td>
                  <td className="text-right">{tpl.lines.length}</td>
                  <td className="text-right">{oreToKronor(totalDebit).toLocaleString("sv-SE")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem" }}
                      onClick={() => navigate(`/templates/${tpl.id}/edit`)}
                    >
                      {t("common.edit")}
                    </button>
                    {isDeleting ? (
                      <>
                        <span style={{ marginRight: "0.5rem", color: "var(--color-negative)" }}>
                          {t("templates.deleteConfirm")}
                        </span>
                        <button
                          style={{ padding: "0.25rem 0.5rem", marginRight: "0.25rem" }}
                          onClick={() => deleteMutation.mutate(tpl.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {t("common.yes")}
                        </button>
                        <button
                          className="secondary"
                          style={{ padding: "0.25rem 0.5rem" }}
                          onClick={() => setDeleteId(null)}
                        >
                          {t("common.no")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="secondary"
                        style={{ padding: "0.25rem 0.5rem", color: "var(--color-negative)" }}
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        {t("common.delete")}
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
