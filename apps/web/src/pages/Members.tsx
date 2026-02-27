import { useState, useCallback, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError, type MemberRole, type OrgMemberWithUser } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDialogFocus } from "../hooks/useDialogFocus";
import dialogStyles from "../components/Dialog.module.css";

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Ägare",
  ADMIN: "Administratör",
  MEMBER: "Medlem",
};

export function Members() {
  const { organization } = useOrganization();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<MemberRole>("MEMBER");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<OrgMemberWithUser | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("MEMBER");

  const [removingMember, setRemovingMember] = useState<OrgMemberWithUser | null>(null);

  const closeAdd = useCallback(() => setShowAdd(false), []);
  const closeEdit = useCallback(() => setEditingMember(null), []);
  const addDialogRef = useDialogFocus(showAdd, closeAdd);
  const editDialogRef = useDialogFocus(!!editingMember, closeEdit);

  const membersQuery = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.getMembers(orgId),
  });

  const addMutation = useMutation({
    mutationFn: () => api.addMember(orgId, addEmail, addRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      setShowAdd(false);
      setAddEmail("");
      setAddRole("MEMBER");
      setAddError(null);
      addToast("Medlemmen har lagts till.");
    },
    onError: (err: Error) => {
      if (err instanceof ApiError) {
        setAddError(err.message);
      } else {
        setAddError("Ett oväntat fel uppstod.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      api.updateMemberRole(orgId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      setEditingMember(null);
      addToast("Rollen har uppdaterats.");
    },
    onError: (err: Error) => {
      addToast(err.message, "error");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      setRemovingMember(null);
      addToast("Medlemmen har tagits bort.");
    },
    onError: (err: Error) => {
      addToast(err.message, "error");
      setRemovingMember(null);
    },
  });

  const members = membersQuery.data?.data ?? [];

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    addMutation.mutate();
  }

  function handleUpdateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    updateMutation.mutate({ userId: editingMember.userId, role: editRole });
  }

  if (membersQuery.isLoading) {
    return <div className="loading">Laddar medlemmar…</div>;
  }

  if (membersQuery.isError) {
    return <div className="error">Kunde inte hämta medlemmar: {membersQuery.error.message}</div>;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2>Medlemmar</h2>
        <button onClick={() => setShowAdd(true)}>Lägg till medlem</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Namn</th>
            <th>E-post</th>
            <th>Roll</th>
            <th style={{ width: "120px" }}>Åtgärder</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user.name}</td>
              <td>{m.user.email}</td>
              <td>{ROLE_LABELS[m.role]}</td>
              <td>
                {m.userId !== currentUser?.id && (
                  <span style={{ display: "flex", gap: "0.25rem" }}>
                    <button
                      className="secondary btn-sm"
                      onClick={() => {
                        setEditingMember(m);
                        setEditRole(m.role);
                      }}
                    >
                      Ändra
                    </button>
                    <button className="danger btn-sm" onClick={() => setRemovingMember(m)}>
                      Ta bort
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", color: "#666" }}>
                Inga medlemmar hittades.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add member dialog */}
      {showAdd && (
        <div className={dialogStyles.overlay} onClick={() => setShowAdd(false)}>
          <div
            ref={addDialogRef}
            className={dialogStyles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-member-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={dialogStyles.header}>
              <h3 id="add-member-title">Lägg till medlem</h3>
              <button
                className="btn-icon"
                onClick={() => setShowAdd(false)}
                type="button"
                aria-label="Stäng"
              >
                ×
              </button>
            </div>
            {addError && (
              <div className="error" style={{ marginBottom: "1rem" }}>
                {addError}
              </div>
            )}
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label htmlFor="add-email">E-postadress</label>
                <input
                  id="add-email"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="namn@exempel.se"
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-role">Roll</label>
                <select
                  id="add-role"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as MemberRole)}
                >
                  <option value="MEMBER">Medlem</option>
                  <option value="ADMIN">Administratör</option>
                  <option value="OWNER">Ägare</option>
                </select>
              </div>
              <div className={dialogStyles.actions}>
                <button type="button" className="secondary" onClick={() => setShowAdd(false)}>
                  Avbryt
                </button>
                <button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Lägger till…" : "Lägg till"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit role dialog */}
      {editingMember && (
        <div className={dialogStyles.overlay} onClick={() => setEditingMember(null)}>
          <div
            ref={editDialogRef}
            className={dialogStyles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-role-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={dialogStyles.header}>
              <h3 id="edit-role-title">Ändra roll</h3>
              <button
                className="btn-icon"
                onClick={() => setEditingMember(null)}
                type="button"
                aria-label="Stäng"
              >
                ×
              </button>
            </div>
            <p className={dialogStyles.description}>
              Ändra roll för <strong>{editingMember.user.name}</strong> ({editingMember.user.email})
            </p>
            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group">
                <label htmlFor="edit-role">Roll</label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as MemberRole)}
                >
                  <option value="MEMBER">Medlem</option>
                  <option value="ADMIN">Administratör</option>
                  <option value="OWNER">Ägare</option>
                </select>
              </div>
              <div className={dialogStyles.actions}>
                <button type="button" className="secondary" onClick={() => setEditingMember(null)}>
                  Avbryt
                </button>
                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Sparar…" : "Spara"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove member confirm */}
      <ConfirmDialog
        open={!!removingMember}
        title="Ta bort medlem"
        message={
          removingMember
            ? `Vill du ta bort ${removingMember.user.name} (${removingMember.user.email}) från organisationen?`
            : ""
        }
        confirmLabel="Ta bort"
        onConfirm={() => removingMember && removeMutation.mutate(removingMember.userId)}
        onCancel={() => setRemovingMember(null)}
        isPending={removeMutation.isPending}
      />
    </div>
  );
}
