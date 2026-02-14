import type { PrismaClient } from "@prisma/client";
import type {
  FiscalYear,
  CreateFiscalYearInput,
  FiscalYearError,
} from "@muninsbok/core";
import { ok, err, type Result } from "@muninsbok/core";
import { toFiscalYear } from "../mappers.js";

export class FiscalYearRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<FiscalYear[]> {
    const years = await this.prisma.fiscalYear.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
    });
    return years.map(toFiscalYear);
  }

  async findById(
    id: string,
    organizationId: string
  ): Promise<FiscalYear | null> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId },
    });
    return fy ? toFiscalYear(fy) : null;
  }

  async create(
    input: CreateFiscalYearInput
  ): Promise<Result<FiscalYear, FiscalYearError>> {
    // Validate date range
    if (input.endDate <= input.startDate) {
      return err({
        code: "INVALID_DATE_RANGE",
        message: "Slutdatum måste vara efter startdatum",
      });
    }

    // Check for overlapping fiscal years
    const existing = await this.prisma.fiscalYear.findMany({
      where: { organizationId: input.organizationId },
    });

    const overlaps = existing.some((fy) => {
      const existingStart = fy.startDate.getTime();
      const existingEnd = fy.endDate.getTime();
      const newStart = input.startDate.getTime();
      const newEnd = input.endDate.getTime();
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (overlaps) {
      return err({
        code: "OVERLAPPING_YEAR",
        message: "Räkenskapsåret överlappar med ett befintligt",
      });
    }

    const fy = await this.prisma.fiscalYear.create({
      data: {
        organizationId: input.organizationId,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    return ok(toFiscalYear(fy));
  }

  async close(
    id: string,
    organizationId: string
  ): Promise<Result<FiscalYear, FiscalYearError>> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId },
    });

    if (!fy) {
      return err({
        code: "NOT_FOUND",
        message: "Räkenskapsåret hittades inte",
      });
    }

    if (fy.isClosed) {
      return err({
        code: "YEAR_CLOSED",
        message: "Räkenskapsåret är redan stängt",
      });
    }

    const updated = await this.prisma.fiscalYear.update({
      where: { id },
      data: { isClosed: true },
    });

    return ok(toFiscalYear(updated));
  }
}
