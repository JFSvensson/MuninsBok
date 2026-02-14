interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Bekräfta", onConfirm, onCancel, isPending }: Props) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog dialog-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onCancel} type="button">×</button>
        </div>
        <p className="dialog-description">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Avbryt
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Vänta..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
