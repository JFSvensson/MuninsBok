import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError, type InvoiceStatus } from "../api";
import { formatAmount, oreToKronor, formatDate } from "../utils/formatting";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "invoices.statusDraft",
  SENT: "invoices.statusSent",
  PAID: "invoices.statusPaid",
  OVERDUE: "invoices.statusOverdue",
  CANCELLED: "invoices.statusCancelled",
  CREDITED: "invoices.statusCredited",
};

export function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { organization } = useOrganization();
  const { t } = useLocale();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPaidDate, setShowPaidDate] = useState(false);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));

  const invoiceQuery = useQuery({
    queryKey: ["invoice", orgId, invoiceId],
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    queryFn: () => api.getInvoice(orgId, invoiceId!),
    enabled: !!invoiceId,
  });

  const customerQuery = useQuery({
    queryKey: ["customer", orgId, invoiceQuery.data?.data.customerId],
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    queryFn: () => api.getCustomer(orgId, invoiceQuery.data!.data.customerId),
    enabled: !!invoiceQuery.data?.data.customerId,
  });

  const statusMutation = useMutation({
    mutationFn: (data: { status: string; paidDate?: string }) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api.updateInvoiceStatus(orgId, invoiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", orgId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      addToast(t("invoices.statusChanged"), "success");
      setShowPaidDate(false);
    },
    onError: (err: Error) => {
      addToast(err instanceof ApiError ? err.message : t("common.error"), "error");
    },
  });

  const deleteMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    mutationFn: () => api.deleteInvoice(orgId, invoiceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      addToast(t("invoices.deleted"), "success");
      navigate("/invoices");
    },
    onError: (err: Error) => {
      addToast(err instanceof ApiError ? err.message : t("common.error"), "error");
    },
  });

  if (invoiceQuery.isLoading) return <p>{t("common.loading")}</p>;
  if (!invoiceQuery.data) return <p>{t("common.error")}</p>;

  const inv = invoiceQuery.data.data;
  const customer = customerQuery.data?.data;
  const isDraft = inv.status === "DRAFT";
  const isSent = inv.status === "SENT";
  const isOverdue = inv.status === "OVERDUE";

  return (
    <div>
      <div className="flex-between mb-1">
        <h2>
          {t("invoices.number")} {inv.invoiceNumber}
        </h2>
        <Link to="/invoices">{t("common.back")}</Link>
      </div>

      <div className="card mb-1">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <p>
              <strong>{t("invoices.customer")}:</strong> {customer?.name ?? inv.customerId}
            </p>
            <p>
              <strong>{t("invoices.issueDate")}:</strong> {formatDate(inv.issueDate)}
            </p>
            <p>
              <strong>{t("invoices.dueDate")}:</strong> {formatDate(inv.dueDate)}
            </p>
            {inv.paidDate && (
              <p>
                <strong>{t("invoices.paidDate")}:</strong> {formatDate(inv.paidDate)}
              </p>
            )}
          </div>
          <div>
            <p>
              <strong>Status:</strong>{" "}
              {t(STATUS_LABELS[inv.status as InvoiceStatus] as Parameters<typeof t>[0])}
            </p>
            {inv.ourReference && (
              <p>
                <strong>{t("invoices.ourReference")}:</strong> {inv.ourReference}
              </p>
            )}
            {inv.yourReference && (
              <p>
                <strong>{t("invoices.yourReference")}:</strong> {inv.yourReference}
              </p>
            )}
            {inv.notes && (
              <p>
                <strong>{t("invoices.notes")}:</strong> {inv.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invoice lines */}
      <div className="card mb-1">
        <h3>{t("invoices.lines")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("invoices.line.description")}</th>
              <th style={{ textAlign: "right" }}>{t("invoices.line.quantity")}</th>
              <th style={{ textAlign: "right" }}>{t("invoices.line.unitPrice")}</th>
              <th style={{ textAlign: "right" }}>{t("invoices.line.vatRate")}</th>
              <th style={{ textAlign: "right" }}>{t("invoices.line.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td style={{ textAlign: "right" }}>{(line.quantity / 100).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{formatAmount(oreToKronor(line.unitPrice))}</td>
                <td style={{ textAlign: "right" }}>{(line.vatRate / 100).toFixed(0)}%</td>
                <td style={{ textAlign: "right" }}>{formatAmount(oreToKronor(line.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>
                <strong>{t("invoices.subtotal")}:</strong>
              </td>
              <td style={{ textAlign: "right" }}>{formatAmount(oreToKronor(inv.subtotal))}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>
                <strong>{t("invoices.vatAmount")}:</strong>
              </td>
              <td style={{ textAlign: "right" }}>{formatAmount(oreToKronor(inv.vatAmount))}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>
                <strong>{t("invoices.totalAmount")}:</strong>
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>{formatAmount(oreToKronor(inv.totalAmount))}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {isDraft && (
          <>
            <Link to={`/invoices/${inv.id}/edit`}>
              <button>{t("common.edit")}</button>
            </Link>
            <button className="secondary" onClick={() => statusMutation.mutate({ status: "SENT" })}>
              {t("invoices.send")}
            </button>
            <button
              className="secondary"
              onClick={() => statusMutation.mutate({ status: "CANCELLED" })}
            >
              {t("invoices.cancel")}
            </button>
            <button className="danger" onClick={() => setConfirmDelete(true)}>
              {t("common.delete")}
            </button>
          </>
        )}
        {(isSent || isOverdue) && (
          <>
            <button onClick={() => setShowPaidDate(true)}>{t("invoices.markPaid")}</button>
            <button
              className="secondary"
              onClick={() => statusMutation.mutate({ status: "CANCELLED" })}
            >
              {t("invoices.cancel")}
            </button>
          </>
        )}
      </div>

      {showPaidDate && (
        <div className="card mt-1">
          <label>
            {t("invoices.paidDate")}:
            <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </label>
          <div className="flex-between mt-1">
            <button className="secondary" onClick={() => setShowPaidDate(false)}>
              {t("common.cancel")}
            </button>
            <button onClick={() => statusMutation.mutate({ status: "PAID", paidDate })}>
              {t("invoices.markPaid")}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          title={t("common.delete")}
          message={t("invoices.deleteConfirm")}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
