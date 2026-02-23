import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import type { DateRange } from "../components/DateFilter";

/**
 * Generic hook for org+fiscalYear scoped report queries with optional date range filtering.
 * Encapsulates the repeated pattern across all 7 report pages.
 */
export function useReportQuery<T>(
  key: string,
  apiFn: (orgId: string, fyId: string, dateRange?: DateRange) => Promise<T>,
) {
  const { organization, fiscalYear } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const query = useQuery({
    queryKey: [key, organization?.id, fiscalYear?.id, dateRange],
    queryFn: () => apiFn(defined(organization).id, defined(fiscalYear).id, dateRange),
    enabled: !!organization && !!fiscalYear,
  });

  return { ...query, dateRange, setDateRange, organization, fiscalYear };
}
