import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useDialogFocus } from "../hooks/useDialogFocus";
import dialogStyles from "./Dialog.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  onDeleted: () => void;
}

export function DeleteOrganizationDialog({
  open,
  onClose,
  organizationId,
  organizationName,
  onDeleted,
}: Props) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const [exportOrBackupConfirmed, setExportOrBackupConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setConfirmName("");
    setExportOrBackupConfirmed(false);
    setError(null);
    onClose();
  }, [onClose]);

  const dialogRef = useDialogFocus(open, handleClose);

  const mutation = useMutation({
    mutationFn: () => api.deleteOrganization(organizationId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onDeleted();
      handleClose();
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

  const canDelete = confirmName === organizationName && exportOrBackupConfirmed;

  if (!open) return null;

  return (
    <div className={dialogStyles.overlay} onClick={handleClose}>
      <div
        ref={dialogRef}
        className={dialogStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-org-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={dialogStyles.header}>
          <h3 id="delete-org-title">Radera organisation</h3>
          <button className="btn-icon" onClick={handleClose} type="button" aria-label="Stäng">
            ×
          </button>
        </div>

        <p className={dialogStyles.description} style={{ color: "var(--color-negative)" }}>
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

          <label>
            <input
              type="checkbox"
              checked={exportOrBackupConfirmed}
              onChange={(e) => setExportOrBackupConfirmed(e.target.checked)}
            />
            Jag bekräftar att organisationens bokföringsdata har exporterats eller
            säkerhetskopierats.
          </label>

          <div className={dialogStyles.actions}>
            <button type="button" className="secondary" onClick={handleClose}>
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
