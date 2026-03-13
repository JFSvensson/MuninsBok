import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../context/LocaleContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import { formatAmount, parseAmountToOre, oreToKronor } from "../utils/formatting";

interface TemplateLineInput {
  accountNumber: string;
  debit: string;
  credit: string;
  description: string;
}

const createEmptyLine = (): TemplateLineInput => ({
  accountNumber: "",
  debit: "",
  credit: "",
  description: "",
});

function calculateFirstRunDate(frequency: "MONTHLY" | "QUARTERLY", dayOfMonth: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (next <= now) {
    next.setMonth(next.getMonth() + (frequency === "QUARTERLY" ? 3 : 1));
  }
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, maxDay));
  return next;
}

export function VoucherTemplateForm() {
  const { templateId } = useParams<{ templateId: string }>();
  const isEdit = Boolean(templateId);
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const orgId = defined(organization).id;
  const { t } = useLocale();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<TemplateLineInput[]>([createEmptyLine(), createEmptyLine()]);
  const [error, setError] = useState<string | null>(null);

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"MONTHLY" | "QUARTERLY">("MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [recurringEndDate, setRecurringEndDate] = useState("");

  // Load accounts
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", orgId],
    queryFn: () => api.getAccounts(orgId),
  });
  const accounts = accountsData?.data ?? [];

  // Load existing template for edit
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["voucher-template", orgId, templateId],
    queryFn: () => api.getVoucherTemplate(orgId, templateId as string),
    enabled: isEdit && Boolean(templateId),
  });

  // Populate form when template loads
  useEffect(() => {
    if (templateData?.data) {
      const tpl = templateData.data;
      setName(tpl.name);
      setDescription(tpl.description ?? "");
      setLines(
        tpl.lines.map((l) => ({
          accountNumber: l.accountNumber,
          debit: l.debit > 0 ? oreToKronor(l.debit).toString() : "",
          credit: l.credit > 0 ? oreToKronor(l.credit).toString() : "",
          description: l.description ?? "",
        })),
      );
      setIsRecurring(tpl.isRecurring ?? false);
      setFrequency(tpl.frequency ?? "MONTHLY");
      setDayOfMonth(tpl.dayOfMonth ?? 1);
      setRecurringEndDate(tpl.recurringEndDate ? tpl.recurringEndDate.slice(0, 10) : "");
    }
  }, [templateData]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createVoucherTemplate>[1]) =>
      api.createVoucherTemplate(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      addToast(t("templates.created"), "success");
      navigate("/templates");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateVoucherTemplate>[2]) => {
      if (!templateId) throw new Error("Template ID is required");
      return api.updateVoucherTemplate(orgId, templateId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      queryClient.invalidateQueries({ queryKey: ["voucher-template", orgId, templateId] });
      addToast(t("templates.updated"), "success");
      navigate("/templates");
    },
    onError: (err: Error) => setError(err.message),
  });

  const recurringMutation = useMutation({
    mutationFn: () => {
      if (!templateId) throw new Error("Mall-ID krävs");
      return api.updateRecurringSchedule(orgId, templateId, {
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        dayOfMonth: isRecurring ? dayOfMonth : undefined,
        nextRunDate: isRecurring
          ? calculateFirstRunDate(frequency, dayOfMonth).toISOString()
          : undefined,
        recurringEndDate: recurringEndDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-templates"] });
      queryClient.invalidateQueries({ queryKey: ["voucher-template", orgId, templateId] });
      addToast(t("templates.recurring.updated"), "success");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateLine = useCallback((index: number, field: keyof TemplateLineInput, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Computed
  const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
  const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("templates.form.errorName"));
      return;
    }

    const templateLines = lines
      .filter((l) => l.accountNumber && (l.debit || l.credit))
      .map((l) => ({
        accountNumber: l.accountNumber,
        debit: parseAmountToOre(l.debit),
        credit: parseAmountToOre(l.credit),
        description: l.description || undefined,
      }));

    if (templateLines.length === 0) {
      setError(t("templates.form.errorLine"));
      return;
    }

    // Check for dual entry lines
    const hasDualEntry = templateLines.some((l) => l.debit > 0 && l.credit > 0);
    if (hasDualEntry) {
      setError(t("templates.form.errorDualEntry"));
      return;
    }

    const payload = {
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      lines: templateLines,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingTemplate) {
    return <div className="loading">{t("common.loading")}</div>;
  }

  return (
    <div className="card">
      <h2>{isEdit ? t("templates.form.title.edit") : t("templates.form.title.new")}</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 mb-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="tpl-name">{t("templates.form.name")}</label>
            <input
              id="tpl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("templates.form.namePlaceholder")}
              required
              maxLength={255}
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="tpl-desc">{t("templates.form.description")}</label>
            <input
              id="tpl-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("templates.form.descPlaceholder")}
              maxLength={1000}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th scope="col">Konto</th>
              <th scope="col" className="text-right">
                Debet (kr)
              </th>
              <th scope="col" className="text-right">
                Kredit (kr)
              </th>
              <th scope="col">Beskrivning</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={line.accountNumber}
                    onChange={(e) => updateLine(index, "accountNumber", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">Välj konto</option>
                    {accounts.map((account) => (
                      <option key={account.number} value={account.number}>
                        {account.number} {account.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.debit}
                    onChange={(e) => updateLine(index, "debit", e.target.value)}
                    placeholder="0,00"
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.credit}
                    onChange={(e) => updateLine(index, "credit", e.target.value)}
                    placeholder="0,00"
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    placeholder="Valfri"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 1}
                    style={{ padding: "0.25rem 0.5rem" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <button type="button" className="secondary" onClick={addLine}>
                  + Lägg till rad
                </button>
              </td>
              <td className="text-right amount">
                <strong>{formatAmount(totalDebit)}</strong>
              </td>
              <td className="text-right amount">
                <strong>{formatAmount(totalCredit)}</strong>
              </td>
              <td colSpan={2}>
                {!isBalanced && totalDebit > 0 && (
                  <span style={{ color: "var(--color-negative)" }}>
                    Differens: {formatAmount(totalDebit - totalCredit)}
                  </span>
                )}
                {isBalanced && totalDebit > 0 && (
                  <span style={{ color: "var(--color-positive)" }}>✓ Balanserar</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between items-center" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={() => navigate("/templates")}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={isPending}>
            {isPending
              ? t("templates.form.saving")
              : isEdit
                ? t("templates.form.submit.edit")
                : t("templates.form.submit.create")}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h3>{t("templates.recurring.title")}</h3>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ marginRight: "0.5rem" }}
              />
              {t("templates.recurring.enabled")}
            </label>
          </div>

          {isRecurring && (
            <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
              <div className="form-group">
                <label htmlFor="tpl-freq">{t("templates.recurring.frequency")}</label>
                <select
                  id="tpl-freq"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as "MONTHLY" | "QUARTERLY")}
                >
                  <option value="MONTHLY">{t("templates.recurring.monthly")}</option>
                  <option value="QUARTERLY">{t("templates.recurring.quarterly")}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tpl-day">{t("templates.recurring.dayOfMonth")}</label>
                <input
                  id="tpl-day"
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
                  style={{ width: "5rem" }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tpl-end">{t("templates.recurring.endDate")}</label>
                <input
                  id="tpl-end"
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => recurringMutation.mutate()}
            disabled={recurringMutation.isPending}
          >
            {recurringMutation.isPending
              ? t("templates.form.saving")
              : t("templates.recurring.save")}
          </button>
        </div>
      )}
    </div>
  );
}
