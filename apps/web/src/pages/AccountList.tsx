import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { api, type Account } from "../api";

const ACCOUNT_TYPES = [
  { value: "", label: "Alla typer" },
  { value: "ASSET", label: "Tillgång" },
  { value: "LIABILITY", label: "Skuld" },
  { value: "EQUITY", label: "Eget kapital" },
  { value: "REVENUE", label: "Intäkt" },
  { value: "EXPENSE", label: "Kostnad" },
] as const;

const TYPE_LABELS: Record<Account["type"], string> = {
  ASSET: "Tillgång",
  LIABILITY: "Skuld",
  EQUITY: "Eget kapital",
  REVENUE: "Intäkt",
  EXPENSE: "Kostnad",
};

export function AccountList() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create account form state
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Account["type"]>("EXPENSE");
  const [newIsVat, setNewIsVat] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts", organization?.id, showAll],
    queryFn: () => api.getAccounts(organization!.id, !showAll),
    enabled: !!organization,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createAccount(organization!.id, {
        number: newNumber,
        name: newName,
        type: newType,
        isVatAccount: newIsVat,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", organization?.id] });
      setNewNumber("");
      setNewName("");
      setNewType("EXPENSE");
      setNewIsVat(false);
      setShowCreateForm(false);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (accountNumber: string) =>
      api.deactivateAccount(organization!.id, accountNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", organization?.id] });
    },
  });

  const accounts = data?.data ?? [];

  const filtered = accounts.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.number.includes(q) || a.name.toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) return <div className="loading">Laddar konton...</div>;
  if (error) return <div className="error">Fel: {(error as Error).message}</div>;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Kontoplan</h2>
        <button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Stäng" : "+ Nytt konto"}
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ background: "#f9f9f9", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Skapa nytt konto</h3>
          {formError && <div className="error">{formError}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              createMutation.mutate();
            }}
          >
            <div className="flex gap-2 mb-1">
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="acc-number">Kontonummer</label>
                <input
                  id="acc-number"
                  type="text"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="1000-9999"
                  required
                  pattern="[0-9]{4}"
                  title="Fyra siffror"
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="acc-name">Kontonamn</label>
                <input
                  id="acc-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="T.ex. Kassa"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="acc-type">Typ</label>
                <select
                  id="acc-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as Account["type"])}
                >
                  <option value="ASSET">Tillgång</option>
                  <option value="LIABILITY">Skuld</option>
                  <option value="EQUITY">Eget kapital</option>
                  <option value="REVENUE">Intäkt</option>
                  <option value="EXPENSE">Kostnad</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={newIsVat}
                  onChange={(e) => setNewIsVat(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Momskonto
              </label>
              <div style={{ marginLeft: "auto" }}>
                <button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Skapar..." : "Skapa konto"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök konto..."
          style={{ flex: 1 }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 400, whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            style={{ width: "auto" }}
          />
          Visa inaktiva
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Inga konton hittades.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nummer</th>
              <th>Namn</th>
              <th>Typ</th>
              <th>Moms</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => (
              <tr key={account.number} style={!account.isActive ? { opacity: 0.5 } : undefined}>
                <td><strong>{account.number}</strong></td>
                <td>{account.name}</td>
                <td>{TYPE_LABELS[account.type]}</td>
                <td>{account.isVatAccount ? "Ja" : "Nej"}</td>
                <td>{account.isActive ? "Aktiv" : "Inaktiv"}</td>
                <td>
                  {account.isActive && (
                    <button
                      className="secondary"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                      onClick={() => {
                        if (confirm(`Inaktivera konto ${account.number} ${account.name}?`)) {
                          deactivateMutation.mutate(account.number);
                        }
                      }}
                    >
                      Inaktivera
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.85rem" }}>
        Visar {filtered.length} av {accounts.length} konton
      </p>
    </div>
  );
}
