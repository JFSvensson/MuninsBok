import { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { CreateFiscalYearDialog } from "./CreateFiscalYearDialog";
import { DeleteOrganizationDialog } from "./DeleteOrganizationDialog";
import { EditOrganizationDialog } from "./EditOrganizationDialog";

export function OrganizationSelect() {
  const {
    organization,
    fiscalYear,
    setOrganization,
    setFiscalYear,
    organizations,
    fiscalYears,
    isLoading,
  } = useOrganization();

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateFy, setShowCreateFy] = useState(false);
  const [showDeleteOrg, setShowDeleteOrg] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);

  if (isLoading) {
    return <span>Laddar...</span>;
  }

  return (
    <>
      <div className="flex gap-1 items-center">
        <select
          value={organization?.id ?? ""}
          onChange={(e) => {
            const org = organizations.find((o) => o.id === e.target.value);
            setOrganization(org ?? null);
          }}
          style={{ width: "auto" }}
        >
          <option value="">Välj organisation</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <button className="btn-icon" title="Ny organisation" onClick={() => setShowCreateOrg(true)}>
          +
        </button>

        {organization && (
          <button
            className="btn-icon"
            title="Redigera organisation"
            onClick={() => setShowEditOrg(true)}
          >
            ✏
          </button>
        )}

        {organization && (
          <button
            className="btn-icon btn-icon-danger"
            title="Radera organisation"
            onClick={() => setShowDeleteOrg(true)}
          >
            🗑
          </button>
        )}

        {organization && (
          <>
            <select
              value={fiscalYear?.id ?? ""}
              onChange={(e) => {
                const fy = fiscalYears.find((f) => f.id === e.target.value);
                setFiscalYear(fy ?? null);
              }}
              style={{ width: "auto" }}
            >
              <option value="">Välj räkenskapsår</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {new Date(fy.startDate).getFullYear()}
                  {fy.isClosed ? " (stängt)" : ""}
                </option>
              ))}
            </select>

            <button
              className="btn-icon"
              title="Nytt räkenskapsår"
              onClick={() => setShowCreateFy(true)}
            >
              +
            </button>
          </>
        )}
      </div>

      <CreateOrganizationDialog
        open={showCreateOrg}
        onClose={() => setShowCreateOrg(false)}
        onCreated={(org) => setOrganization(org)}
      />

      {organization && (
        <>
          <CreateFiscalYearDialog
            open={showCreateFy}
            onClose={() => setShowCreateFy(false)}
            onCreated={(fy) => setFiscalYear(fy)}
            organization={organization}
            fiscalYears={fiscalYears}
          />
          <DeleteOrganizationDialog
            open={showDeleteOrg}
            onClose={() => setShowDeleteOrg(false)}
            organizationId={organization.id}
            organizationName={organization.name}
            onDeleted={() => setOrganization(null)}
          />
          <EditOrganizationDialog
            open={showEditOrg}
            onClose={() => setShowEditOrg(false)}
            organization={organization}
            onUpdated={(org) => setOrganization(org)}
          />
        </>
      )}
    </>
  );
}
