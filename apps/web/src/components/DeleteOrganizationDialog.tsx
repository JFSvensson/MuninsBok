import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onDeleted: () => void;
}

export function DeleteOrganizationDialog({ open, onClose, organizationId, organizationName, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.deleteOrganization(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onDeleted();
      resetAndClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resetAndClose = () => {
    setConfirmName("");
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  const canDelete = confirmName === organizationName;

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={resetAndClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Radera organisation</h3>
          <button className="btn-icon" onClick={resetAndClose} type="button">×</button>
        </div>

        <p className="dialog-description" style={{ color: "#c62828" }}>
          <strong>Varning!</strong> Alla räkenskapsår, konton, verifikat och dokument kopplade till
          denna organisation raderas permanent.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="confirm-name">
              Skriv <strong>{organizationName}</strong> för att bekräfta
            </label>
            <input
              id="confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={organizationName}
              autoFocus
            />
          </div>

          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={resetAndClose}>
              Avbryt
            </button>
            <button type="submit" disabled={!canDelete || mutation.isPending} className="danger">
              {mutation.isPending ? "Raderar..." : "Radera organisation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
