import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useVoucherForm } from "../hooks/useVoucherForm";
import { api } from "../api";
import { formatAmount } from "../utils/formatting";

export function VoucherCreate() {
  const { organization, fiscalYear } = useOrganization();
  const navigate = useNavigate();

  const {
    date,
    setDate,
    description,
    setDescription,
    lines,
    error,
    updateLine,
    addLine,
    removeLine,
    totalDebit,
    totalCredit,
    isBalanced,
    canSubmit,
    submit,
    isPending,
  } = useVoucherForm({
    organizationId: organization?.id ?? "",
    fiscalYearId: fiscalYear?.id ?? "",
    onSuccess: () => navigate("/vouchers"),
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", organization?.id],
    queryFn: () => api.getAccounts(organization!.id),
    enabled: !!organization,
  });

  const accounts = accountsData?.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

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
                <strong>{formatAmount(totalDebit)}</strong>
              </td>
              <td className="text-right amount">
                <strong>{formatAmount(totalCredit)}</strong>
              </td>
              <td colSpan={2}>
                {!isBalanced && (
                  <span style={{ color: "#c62828" }}>
                    Differens: {formatAmount(totalDebit - totalCredit)}
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
          <button type="button" className="secondary" onClick={() => navigate("/vouchers")}>
            Avbryt
          </button>
          <button type="submit" disabled={!canSubmit}>
            {isPending ? "Sparar..." : "Spara verifikat"}
          </button>
        </div>
      </form>
    </div>
  );
}
