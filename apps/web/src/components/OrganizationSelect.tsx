import { useOrganization } from "../context/OrganizationContext";

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

  if (isLoading) {
    return <span>Laddar...</span>;
  }

  return (
    <div className="flex gap-2">
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

      {organization && (
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
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
