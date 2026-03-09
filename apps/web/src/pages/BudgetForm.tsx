import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import { formatAmount, parseAmountToOre, oreToKronor } from "../utils/formatting";

interface BudgetEntryInput {
  accountNumber: string;
  month: string;
  amount: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

const createEmptyEntry = (): BudgetEntryInput => ({
  accountNumber: "",
  month: "1",
  amount: "",
});

export function BudgetForm() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const isEdit = Boolean(budgetId);
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const orgId = defined(organization).id;
  const fyId = defined(fiscalYear).id;

  // Form state
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<BudgetEntryInput[]>([
    createEmptyEntry(),
    createEmptyEntry(),
  ]);
  const [error, setError] = useState<string | null>(null);

  // Load accounts
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", orgId],
    queryFn: () => api.getAccounts(orgId),
  });
  const accounts = accountsData?.data ?? [];

  // Load existing budget for edit
  const { data: budgetData, isLoading: isLoadingBudget } = useQuery({
    queryKey: ["budget", orgId, budgetId],
    queryFn: () => api.getBudget(orgId, budgetId as string),
    enabled: isEdit && Boolean(budgetId),
  });

  // Populate form when budget loads
  useEffect(() => {
    if (budgetData?.data) {
      const b = budgetData.data;
      setName(b.name);
      setEntries(
        b.entries.map((e) => ({
          accountNumber: e.accountNumber,
          month: e.month.toString(),
          amount: oreToKronor(e.amount).toString(),
        })),
      );
    }
  }, [budgetData]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createBudget>[1]) => api.createBudget(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      addToast("Budgeten har skapats", "success");
      navigate("/budgets");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateBudget>[2]) => {
      if (!budgetId) throw new Error("Budget ID is required");
      return api.updateBudget(orgId, budgetId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget", orgId, budgetId] });
      addToast("Budgeten har uppdaterats", "success");
      navigate("/budgets");
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateEntry = useCallback((index: number, field: keyof BudgetEntryInput, value: string) => {
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
    );
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEmptyEntry()]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Computed total
  const total = entries.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Budgetnamn krävs");
      return;
    }

    const budgetEntries = entries
      .filter((e) => e.accountNumber && e.amount)
      .map((e) => ({
        accountNumber: e.accountNumber,
        month: parseInt(e.month, 10),
        amount: parseAmountToOre(e.amount),
      }));

    if (budgetEntries.length === 0) {
      setError("Budgeten måste ha minst en rad med konto och belopp");
      return;
    }

    // Check for zero amounts
    const hasZero = budgetEntries.some((e) => e.amount === 0);
    if (hasZero) {
      setError("Belopp får inte vara 0");
      return;
    }

    if (isEdit) {
      updateMutation.mutate({ name: name.trim(), entries: budgetEntries });
    } else {
      createMutation.mutate({
        fiscalYearId: fyId,
        name: name.trim(),
        entries: budgetEntries,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingBudget) {
    return <div className="loading">Laddar budget…</div>;
  }

  return (
    <div className="card">
      <h2>{isEdit ? "Redigera budget" : "Ny budget"}</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group mb-2">
          <label htmlFor="budget-name">Budgetnamn</label>
          <input
            id="budget-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Huvudbudget 2025"
            required
            maxLength={255}
            style={{ maxWidth: "400px" }}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>Konto</th>
              <th>Månad</th>
              <th className="text-right">Belopp (kr)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={entry.accountNumber}
                    onChange={(e) => updateEntry(index, "accountNumber", e.target.value)}
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
                  <select
                    value={entry.month}
                    onChange={(e) => updateEntry(index, "month", e.target.value)}
                  >
                    {MONTHS.map((label, i) => (
                      <option key={i + 1} value={i + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={entry.amount}
                    onChange={(e) => updateEntry(index, "amount", e.target.value)}
                    placeholder="0,00"
                    style={{ textAlign: "right" }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeEntry(index)}
                    disabled={entries.length <= 1}
                    style={{ padding: "0.25rem 0.5rem" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <button type="button" className="secondary" onClick={addEntry}>
                  + Lägg till rad
                </button>
              </td>
              <td></td>
              <td className="text-right amount">
                <strong>{formatAmount(total)}</strong>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between items-center" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={() => navigate("/budgets")}>
            Avbryt
          </button>
          <button type="submit" disabled={isPending}>
            {isPending ? "Sparar..." : isEdit ? "Spara ändringar" : "Skapa budget"}
          </button>
        </div>
      </form>
    </div>
  );
}
