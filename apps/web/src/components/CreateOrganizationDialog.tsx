import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Organization } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (org: Organization) => void;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
];

export function CreateOrganizationDialog({ open, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [orgNumber, setOrgNumber] = useState("");
  const [name, setName] = useState("");
  const [startMonth, setStartMonth] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.createOrganization({
        orgNumber,
        name,
        fiscalYearStartMonth: startMonth,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onCreated(data.data);
      resetAndClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resetAndClose = () => {
    setOrgNumber("");
    setName("");
    setStartMonth(1);
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={resetAndClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Skapa ny organisation</h3>
          <button className="btn-icon" onClick={resetAndClose} type="button">
            ×
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="org-number">Organisationsnummer</label>
            <input
              id="org-number"
              type="text"
              value={orgNumber}
              onChange={(e) => setOrgNumber(e.target.value)}
              placeholder="XXXXXX-XXXX"
              required
              minLength={10}
              maxLength={12}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="org-name">Namn</label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Företag/förening"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="start-month">Räkenskapsårets startmånad</label>
            <select
              id="start-month"
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={resetAndClose}>
              Avbryt
            </button>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Skapar..." : "Skapa organisation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
