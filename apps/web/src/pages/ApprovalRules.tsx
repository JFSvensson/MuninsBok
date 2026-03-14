import { useState, useCallback, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError, type ApprovalRuleEntity, type MemberRole } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { formatAmount, oreToKronor } from "../utils/formatting";
import dialogStyles from "../components/Dialog.module.css";

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "MEMBER", label: "Medlem" },
  { value: "ADMIN", label: "Administratör" },
  { value: "OWNER", label: "Ägare" },
];

export function ApprovalRules() {
  const { organization } = useOrganization();
  const { t } = useLocale();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApprovalRuleEntity | null>(null);
  const [deleting, setDeleting] = useState<ApprovalRuleEntity | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [requiredRole, setRequiredRole] = useState<MemberRole>("ADMIN");
  const [stepOrder, setStepOrder] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }, []);
  const formRef = useDialogFocus(showForm || !!editing, closeForm);

  const rulesQuery = useQuery({
    queryKey: ["approvalRules", orgId],
    queryFn: () => api.getApprovalRules(orgId),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      minAmount: number;
      maxAmount?: number | null;
      requiredRole: string;
      stepOrder: number;
    }) => api.createApprovalRule(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRules", orgId] });
      closeForm();
      addToast(t("common.save"), "success");
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: Record<string, unknown> }) =>
      api.updateApprovalRule(orgId, ruleId, data as Parameters<typeof api.updateApprovalRule>[2]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRules", orgId] });
      closeForm();
      addToast(t("common.save"), "success");
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => api.deleteApprovalRule(orgId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRules", orgId] });
      setDeleting(null);
      addToast(t("common.delete"), "success");
    },
    onError: (err: Error) => {
      addToast(err instanceof ApiError ? err.message : t("common.error"), "error");
    },
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setMinAmount("");
    setMaxAmount("");
    setRequiredRole("ADMIN");
    setStepOrder("1");
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(rule: ApprovalRuleEntity) {
    setEditing(rule);
    setName(rule.name);
    setMinAmount(String(oreToKronor(rule.minAmount)));
    setMaxAmount(rule.maxAmount != null ? String(oreToKronor(rule.maxAmount)) : "");
    setRequiredRole(rule.requiredRole);
    setStepOrder(String(rule.stepOrder));
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const minKr = Number(minAmount);
    const maxKr = maxAmount ? Number(maxAmount) : null;

    if (isNaN(minKr) || minKr < 0) {
      setFormError("Ange ett giltigt minbelopp");
      return;
    }
    if (maxKr !== null && (isNaN(maxKr) || maxKr <= minKr)) {
      setFormError("Maxbelopp måste vara högre än minbelopp");
      return;
    }

    const data = {
      name,
      minAmount: Math.round(minKr * 100),
      maxAmount: maxKr !== null ? Math.round(maxKr * 100) : null,
      requiredRole,
      stepOrder: parseInt(stepOrder, 10),
    };

    if (editing) {
      updateMutation.mutate({ ruleId: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  if (rulesQuery.isLoading) return <div className="loading">{t("common.loading")}</div>;
  if (rulesQuery.error) return <div className="error">{(rulesQuery.error as Error).message}</div>;

  const rules = rulesQuery.data?.data ?? [];

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>{t("approval.rules")}</h2>
        <button onClick={openCreate}>{t("approval.newRule")}</button>
      </div>

      {rules.length === 0 ? (
        <p>{t("approval.noRules")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t("approval.stepOrder")}</th>
              <th scope="col">{t("approval.ruleName")}</th>
              <th scope="col">{t("approval.minAmount")}</th>
              <th scope="col">{t("approval.maxAmount")}</th>
              <th scope="col">{t("approval.requiredRole")}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {rules
              .sort((a, b) => a.stepOrder - b.stepOrder)
              .map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.stepOrder}</td>
                  <td>{rule.name}</td>
                  <td className="text-right">{formatAmount(oreToKronor(rule.minAmount))} kr</td>
                  <td className="text-right">
                    {rule.maxAmount != null
                      ? `${formatAmount(oreToKronor(rule.maxAmount))} kr`
                      : t("approval.noMaxAmount")}
                  </td>
                  <td>
                    {ROLE_OPTIONS.find((r) => r.value === rule.requiredRole)?.label ??
                      rule.requiredRole}
                  </td>
                  <td>
                    <button className="secondary btn-sm" onClick={() => openEdit(rule)}>
                      {t("common.edit")}
                    </button>{" "}
                    <button className="danger btn-sm" onClick={() => setDeleting(rule)}>
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {/* Create / Edit dialog */}
      {(showForm || editing) && (
        <div className={dialogStyles.overlay} onClick={closeForm}>
          <div
            ref={formRef}
            className={dialogStyles.dialog}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSubmit}>
              <div className={dialogStyles.header}>
                <h3>{editing ? t("approval.editRule") : t("approval.newRule")}</h3>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={closeForm}
                  aria-label={t("common.cancel")}
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="error" style={{ marginBottom: "1rem" }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="rule-name">{t("approval.ruleName")}</label>
                <input
                  id="rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-min">{t("approval.minAmount")}</label>
                <input
                  id="rule-min"
                  type="number"
                  min="0"
                  step="1"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-max">{t("approval.maxAmount")}</label>
                <input
                  id="rule-max"
                  type="number"
                  min="0"
                  step="1"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder={t("approval.noMaxAmount")}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-role">{t("approval.requiredRole")}</label>
                <select
                  id="rule-role"
                  value={requiredRole}
                  onChange={(e) => setRequiredRole(e.target.value as MemberRole)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rule-order">{t("approval.stepOrder")}</label>
                <input
                  id="rule-order"
                  type="number"
                  min="1"
                  step="1"
                  value={stepOrder}
                  onChange={(e) => setStepOrder(e.target.value)}
                  required
                />
              </div>

              <div className={dialogStyles.actions}>
                <button type="button" className="secondary" onClick={closeForm}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title={t("common.delete")}
        message={t("approval.deleteConfirm")}
        confirmLabel={t("common.delete")}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
