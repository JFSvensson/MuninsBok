import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Organization, type FiscalYear } from "../api";

interface OrganizationContextType {
  organization: Organization | null;
  fiscalYear: FiscalYear | null;
  setOrganization: (org: Organization | null) => void;
  setFiscalYear: (fy: FiscalYear | null) => void;
  organizations: Organization[];
  fiscalYears: FiscalYear[];
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [fiscalYear, setFiscalYear] = useState<FiscalYear | null>(null);

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: api.getOrganizations,
  });

  // Fetch fiscal years for selected organization
  const { data: fysData, isLoading: fysLoading } = useQuery({
    queryKey: ["fiscalYears", organization?.id],
    queryFn: () => api.getFiscalYears(organization!.id),
    enabled: !!organization,
  });

  const organizations = orgsData?.data ?? [];
  const fiscalYears = fysData?.data ?? [];

  // Auto-select first organization and fiscal year
  useEffect(() => {
    if (organizations.length > 0 && !organization) {
      setOrganization(organizations[0]!);
    }
  }, [organizations, organization]);

  useEffect(() => {
    if (fiscalYears.length > 0 && !fiscalYear) {
      setFiscalYear(fiscalYears[0]!);
    }
  }, [fiscalYears, fiscalYear]);

  // Reset fiscal year when organization changes
  useEffect(() => {
    setFiscalYear(null);
  }, [organization?.id]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        fiscalYear,
        setOrganization,
        setFiscalYear,
        organizations,
        fiscalYears,
        isLoading: orgsLoading || fysLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}
