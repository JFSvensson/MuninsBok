import type { PrismaClient } from "@prisma/client";
import type {
  Organization,
  CreateOrganizationInput,
  OrganizationError,
  isValidOrgNumber,
} from "@muninsbok/core";
import { ok, err, type Result } from "@muninsbok/core";
import { toOrganization } from "../mappers.js";

export class OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });
    return org ? toOrganization(org) : null;
  }

  async findByOrgNumber(orgNumber: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { orgNumber },
    });
    return org ? toOrganization(org) : null;
  }

  async findAll(): Promise<Organization[]> {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { name: "asc" },
    });
    return orgs.map(toOrganization);
  }

  async create(
    input: CreateOrganizationInput
  ): Promise<Result<Organization, OrganizationError>> {
    // Validate
    if (!input.name || input.name.trim().length === 0) {
      return err({
        code: "INVALID_NAME",
        message: "Namn måste anges",
      });
    }

    const fiscalMonth = input.fiscalYearStartMonth ?? 1;
    if (fiscalMonth < 1 || fiscalMonth > 12) {
      return err({
        code: "INVALID_FISCAL_MONTH",
        message: "Räkenskapsårets startmånad måste vara 1-12",
      });
    }

    // Normalize org number (remove dashes)
    const normalizedOrgNumber = input.orgNumber.replace(/-/g, "");

    const org = await this.prisma.organization.create({
      data: {
        orgNumber: normalizedOrgNumber,
        name: input.name.trim(),
        fiscalYearStartMonth: fiscalMonth,
      },
    });

    return ok(toOrganization(org));
  }

  async update(
    id: string,
    data: Partial<Pick<Organization, "name" | "fiscalYearStartMonth">>
  ): Promise<Organization | null> {
    try {
      const org = await this.prisma.organization.update({
        where: { id },
        data: {
          name: data.name,
          fiscalYearStartMonth: data.fiscalYearStartMonth,
        },
      });
      return toOrganization(org);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.organization.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
