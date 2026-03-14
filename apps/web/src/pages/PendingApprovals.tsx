import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, type ApprovalStepEntity } from "../api";
import { Link } from "react-router-dom";
import { formatDate } from "../utils/formatting";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Ägare",
  ADMIN: "Administratör",
  MEMBER: "Medlem",
};

export function PendingApprovals() {
  const { organization } = useOrganization();
  const { t } = useLocale();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [decidingStep, setDecidingStep] = useState<ApprovalStepEntity | null>(null);
  const [comment, setComment] = useState("");

  const pendingQuery = useQuery({
    queryKey: ["pendingApprovals", orgId],
    queryFn: () => api.getPendingApprovals(orgId),
  });

  const decideMutation = useMutation({
    mutationFn: ({
      voucherId,
      stepId,
      decision,
    }: {
      voucherId: string;
      stepId: string;
      decision: "APPROVED" | "REJECTED";
    }) =>
      api.decideApprovalStep(orgId, voucherId, stepId, {
        decision,
        ...(comment.trim() && { comment: comment.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals", orgId] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["voucher"] });
      setDecidingStep(null);
      setComment("");
      addToast(t("common.save"), "success");
    },
    onError: (err: Error) => {
      addToast(err.message, "error");
    },
  });

  if (pendingQuery.isLoading) return <div className="loading">{t("common.loading")}</div>;
  if (pendingQuery.error)
    return <div className="error">{(pendingQuery.error as Error).message}</div>;

  const steps = pendingQuery.data?.data ?? [];

  return (
    <div className="card">
      <h2>{t("approval.pending")}</h2>

      {steps.length === 0 ? (
        <p>{t("approval.noPending")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Verifikat</th>
              <th scope="col">{t("approval.step")}</th>
              <th scope="col">{t("approval.requiredRole")}</th>
              <th scope="col">Datum</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <td>
                  <Link to={`/vouchers/${step.voucherId}`}>{step.voucherId.slice(0, 8)}…</Link>
                </td>
                <td>{step.stepOrder}</td>
                <td>{ROLE_LABELS[step.requiredRole] ?? step.requiredRole}</td>
                <td>{formatDate(step.createdAt)}</td>
                <td>
                  <button
                    className="btn-sm"
                    onClick={() => {
                      setDecidingStep(step);
                      setComment("");
                    }}
                  >
                    {t("approval.approve")} / {t("approval.reject")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Decision inline form */}
      {decidingStep && (
        <div className="card mt-2" style={{ border: "2px solid var(--accent)" }}>
          <h3>
            {t("approval.step")} {decidingStep.stepOrder} — {decidingStep.voucherId.slice(0, 8)}…
          </h3>
          <div className="form-group">
            <label htmlFor="decision-comment">{t("approval.comment")}</label>
            <textarea
              id="decision-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() =>
                decideMutation.mutate({
                  voucherId: decidingStep.voucherId,
                  stepId: decidingStep.id,
                  decision: "APPROVED",
                })
              }
              disabled={decideMutation.isPending}
            >
              {t("approval.approve")}
            </button>
            <button
              className="danger"
              onClick={() =>
                decideMutation.mutate({
                  voucherId: decidingStep.voucherId,
                  stepId: decidingStep.id,
                  decision: "REJECTED",
                })
              }
              disabled={decideMutation.isPending}
            >
              {t("approval.reject")}
            </button>
            <button className="secondary" onClick={() => setDecidingStep(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
