import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Organization, FiscalYear } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (fy: FiscalYear) => void;
  organization: Organization;
}

export function CreateFiscalYearDialog({ open, onClose, onCreated, organization }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Pre-fill dates based on org's fiscal year start month and current year
  const defaultDates = useMemo(() => {
    const year = new Date().getFullYear();
    const month = organization.fiscalYearStartMonth;
    if (month === 1) {
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      };
    }
    const startMonth = String(month).padStart(2, "0");
    const endMonth = String(month - 1).padStart(2, "0");
    const endYear = year + 1;
    // Last day of the month before start month in next year
    const lastDay = new Date(endYear, month - 1, 0).getDate();
    return {
      start: `${year}-${startMonth}-01`,
      end: `${endYear}-${endMonth}-${String(lastDay).padStart(2, "0")}`,
    };
  }, [organization.fiscalYearStartMonth]);

  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);

  const mutation = useMutation({
    mutationFn: () =>
      api.createFiscalYear(organization.id, { startDate, endDate }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fiscalYears", organization.id] });
      onCreated(data.data);
      resetAndClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resetAndClose = () => {
    setStartDate(defaultDates.start);
    setEndDate(defaultDates.end);
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
          <h3>Nytt räkenskapsår</h3>
          <button className="btn-icon" onClick={resetAndClose} type="button">×</button>
        </div>

        <p className="dialog-description">
          Skapa ett nytt räkenskapsår för <strong>{organization.name}</strong>.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="fy-start">Startdatum</label>
              <input
                id="fy-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="fy-end">Slutdatum</label>
              <input
                id="fy-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={resetAndClose}>
              Avbryt
            </button>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Skapar..." : "Skapa räkenskapsår"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
