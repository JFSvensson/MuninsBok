import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Organization } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  organization: Organization;
  onUpdated: (org: Organization) => void;
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

export function EditOrganizationDialog({ open, onClose, organization, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [startMonth, setStartMonth] = useState(organization.fiscalYearStartMonth);
  const [error, setError] = useState<string | null>(null);

  // Sync state when dialog opens or organization changes
  useEffect(() => {
    if (open) {
      setName(organization.name);
      setStartMonth(organization.fiscalYearStartMonth);
      setError(null);
    }
  }, [open, organization]);

  const mutation = useMutation({
    mutationFn: () =>
      api.updateOrganization(organization.id, {
        name,
        fiscalYearStartMonth: startMonth,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onUpdated(data.data);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  const hasChanges = name !== organization.name || startMonth !== organization.fiscalYearStartMonth;

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Redigera organisation</h3>
          <button className="btn-icon" onClick={onClose} type="button">
            ×
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-org-number">Organisationsnummer</label>
            <input
              id="edit-org-number"
              type="text"
              value={organization.orgNumber}
              disabled
              style={{ opacity: 0.6 }}
            />
            <small className="text-muted">Kan inte ändras</small>
          </div>

          <div className="form-group">
            <label htmlFor="edit-org-name">Namn</label>
            <input
              id="edit-org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Företag/förening"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-start-month">Räkenskapsårets startmånad</label>
            <select
              id="edit-start-month"
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
            <button type="button" className="secondary" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" disabled={mutation.isPending || !hasChanges}>
              {mutation.isPending ? "Sparar..." : "Spara ändringar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
