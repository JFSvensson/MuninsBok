import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError } from "../api";

interface LineForm {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  accountNumber: string;
}

function emptyLine(): LineForm {
  return { description: "", quantity: "1", unitPrice: "", vatRate: "25", accountNumber: "" };
}

export function InvoiceForm() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const isEdit = !!invoiceId;
  const { organization } = useOrganization();
  const { t } = useLocale();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [ourReference, setOurReference] = useState("");
  const [yourReference, setYourReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const customersQuery = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => api.getCustomers(orgId),
  });

  // Load existing invoice data for edit mode
  useQuery({
    queryKey: ["invoice", orgId, invoiceId],
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    queryFn: () => api.getInvoice(orgId, invoiceId!),
    enabled: isEdit && !loaded,
    select: (res) => {
      const inv = res.data;
      setCustomerId(inv.customerId);
      setIssueDate(new Date(inv.issueDate).toISOString().slice(0, 10));
      setDueDate(new Date(inv.dueDate).toISOString().slice(0, 10));
      setOurReference(inv.ourReference ?? "");
      setYourReference(inv.yourReference ?? "");
      setNotes(inv.notes ?? "");
      setLines(
        inv.lines.map((l) => ({
          description: l.description,
          quantity: (l.quantity / 100).toString(),
          unitPrice: (l.unitPrice / 100).toString(),
          vatRate: (l.vatRate / 100).toString(),
          accountNumber: l.accountNumber ?? "",
        })),
      );
      setLoaded(true);
      return res;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createInvoice>[1]) => api.createInvoice(orgId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      addToast(t("invoices.created"), "success");
      navigate(`/invoices/${res.data.id}`);
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api.updateInvoice(orgId, invoiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      queryClient.invalidateQueries({ queryKey: ["invoice", orgId, invoiceId] });
      addToast(t("invoices.updated"), "success");
      navigate(`/invoices/${invoiceId}`);
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  function updateLine(index: number, field: keyof LineForm, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsedLines = lines.map((l) => ({
      description: l.description,
      quantity: Math.round(parseFloat(l.quantity) * 100),
      unitPrice: Math.round(parseFloat(l.unitPrice) * 100),
      vatRate: Math.round(parseFloat(l.vatRate) * 100),
      ...(l.accountNumber ? { accountNumber: l.accountNumber } : {}),
    }));

    if (
      parsedLines.some(
        (l) => !l.description || Number.isNaN(l.quantity) || Number.isNaN(l.unitPrice),
      )
    ) {
      setFormError(t("common.required"));
      return;
    }

    if (isEdit) {
      updateMutation.mutate({
        customerId,
        issueDate,
        dueDate,
        ourReference: ourReference || undefined,
        yourReference: yourReference || undefined,
        notes: notes || undefined,
        lines: parsedLines,
      });
    } else {
      createMutation.mutate({
        customerId,
        issueDate,
        dueDate,
        ourReference: ourReference || undefined,
        yourReference: yourReference || undefined,
        notes: notes || undefined,
        lines: parsedLines,
      });
    }
  }

  const customers = customersQuery.data?.data ?? [];

  // Calculate preview totals
  const previewSubtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const previewVat = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const rate = parseFloat(l.vatRate) || 0;
    return sum + qty * price * (rate / 100);
  }, 0);

  return (
    <div>
      <h2>{isEdit ? t("invoices.form.title.edit") : t("invoices.form.title.new")}</h2>

      <form onSubmit={handleSubmit}>
        <div className="card mb-1">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label>
              {t("invoices.customer")} *
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">– Välj kund –</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerNumber} – {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div />
            <label>
              {t("invoices.issueDate")} *
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </label>
            <label>
              {t("invoices.dueDate")} *
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </label>
            <label>
              {t("invoices.ourReference")}
              <input value={ourReference} onChange={(e) => setOurReference(e.target.value)} />
            </label>
            <label>
              {t("invoices.yourReference")}
              <input value={yourReference} onChange={(e) => setYourReference(e.target.value)} />
            </label>
          </div>
          <label>
            {t("invoices.notes")}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
        </div>

        {/* Invoice lines */}
        <div className="card mb-1">
          <h3>{t("invoices.lines")}</h3>
          <table>
            <thead>
              <tr>
                <th>{t("invoices.line.description")}</th>
                <th style={{ width: "80px" }}>{t("invoices.line.quantity")}</th>
                <th style={{ width: "120px" }}>{t("invoices.line.unitPrice")}</th>
                <th style={{ width: "80px" }}>{t("invoices.line.vatRate")}</th>
                <th style={{ width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <select
                      value={line.vatRate}
                      onChange={(e) => updateLine(i, "vatRate", e.target.value)}
                    >
                      <option value="25">25%</option>
                      <option value="12">12%</option>
                      <option value="6">6%</option>
                      <option value="0">0%</option>
                    </select>
                  </td>
                  <td>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removeLine(i)}
                        style={{ padding: "0.15rem 0.4rem" }}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="secondary"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            style={{ marginTop: "0.5rem" }}
          >
            {t("invoices.addLine")}
          </button>
        </div>

        {/* Totals preview */}
        <div className="card mb-1" style={{ textAlign: "right" }}>
          <p>
            {t("invoices.subtotal")}: <strong>{previewSubtotal.toFixed(2)} kr</strong>
          </p>
          <p>
            {t("invoices.vatAmount")}: <strong>{previewVat.toFixed(2)} kr</strong>
          </p>
          <p style={{ fontSize: "1.2rem" }}>
            {t("invoices.totalAmount")}:{" "}
            <strong>{(previewSubtotal + previewVat).toFixed(2)} kr</strong>
          </p>
        </div>

        {formError && <p className="error">{formError}</p>}

        <div className="flex-between">
          <button type="button" className="secondary" onClick={() => navigate(-1)}>
            {t("common.cancel")}
          </button>
          <button type="submit">{t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
