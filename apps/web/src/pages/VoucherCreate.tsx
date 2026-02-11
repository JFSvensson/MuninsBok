import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api } from "../api";

interface VoucherLineInput {
  accountNumber: string;
  debit: string;
  credit: string;
  description: string;
}

export function VoucherCreate() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<VoucherLineInput[]>([
    { accountNumber: "", debit: "", credit: "", description: "" },
    { accountNumber: "", debit: "", credit: "", description: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", organization?.id],
    queryFn: () => api.getAccounts(organization!.id),
    enabled: !!organization,
  });

  const accounts = accountsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createVoucher>[1]) =>
      api.createVoucher(organization!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      navigate("/vouchers");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const updateLine = (index: number, field: keyof VoucherLineInput, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index]!, [field]: value };
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { accountNumber: "", debit: "", credit: "", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const voucherLines = lines
      .filter((l) => l.accountNumber && (l.debit || l.credit))
      .map((l) => ({
        accountNumber: l.accountNumber,
        debit: Math.round(parseFloat(l.debit || "0") * 100),
        credit: Math.round(parseFloat(l.credit || "0") * 100),
        description: l.description || undefined,
      }));

    if (voucherLines.length < 2) {
      setError("Verifikatet måste ha minst två rader");
      return;
    }

    createMutation.mutate({
      fiscalYearId: fiscalYear!.id,
      date,
      description,
      lines: voucherLines,
    });
  };

  const totalDebit = lines.reduce(
    (sum, l) => sum + parseFloat(l.debit || "0"),
    0
  );
  const totalCredit = lines.reduce(
    (sum, l) => sum + parseFloat(l.credit || "0"),
    0
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="card">
      <h2>Nytt verifikat</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 mb-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="date">Datum</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="description">Beskrivning</label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Kontantförsäljning"
              required
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Konto</th>
              <th className="text-right">Debet</th>
              <th className="text-right">Kredit</th>
              <th>Beskrivning</th>
              <th></th>
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
                    disabled={lines.length <= 2}
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
                <strong>{totalDebit.toFixed(2)}</strong>
              </td>
              <td className="text-right amount">
                <strong>{totalCredit.toFixed(2)}</strong>
              </td>
              <td colSpan={2}>
                {!isBalanced && (
                  <span style={{ color: "#c62828" }}>
                    Differens: {(totalDebit - totalCredit).toFixed(2)}
                  </span>
                )}
                {isBalanced && totalDebit > 0 && (
                  <span style={{ color: "#2e7d32" }}>✓ Balanserar</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between items-center" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate("/vouchers")}
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={!isBalanced || totalDebit === 0 || createMutation.isPending}
          >
            {createMutation.isPending ? "Sparar..." : "Spara verifikat"}
          </button>
        </div>
      </form>
    </div>
  );
}
