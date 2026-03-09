import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetError,
  IBudgetRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { toBudget } from "../mappers.js";

const includeEntries = { entries: true } as const;

export class BudgetRepository implements IBudgetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<Budget[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { organizationId },
      include: includeEntries,
      orderBy: { name: "asc" },
    });
    return budgets.map(toBudget);
  }

  async findByFiscalYear(organizationId: string, fiscalYearId: string): Promise<Budget[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { organizationId, fiscalYearId },
      include: includeEntries,
      orderBy: { name: "asc" },
    });
    return budgets.map(toBudget);
  }

  async findById(id: string, organizationId: string): Promise<Budget | null> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId },
      include: includeEntries,
    });
    return budget ? toBudget(budget) : null;
  }

  async create(
    organizationId: string,
    input: CreateBudgetInput,
  ): Promise<Result<Budget, BudgetError>> {
    // Validate that fiscal year exists and belongs to organization
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: input.fiscalYearId, organizationId },
    });
    if (!fiscalYear) {
      return err({
        code: "FISCAL_YEAR_NOT_FOUND",
        message: "Räkenskapsåret hittades inte",
      });
    }

    if (!input.name.trim()) {
      return err({ code: "NAME_REQUIRED", message: "Namn krävs" });
    }

    if (input.entries.length === 0) {
      return err({ code: "NO_ENTRIES", message: "Budgeten måste ha minst en rad" });
    }

    // Check for duplicate name within same org + fiscal year
    const existing = await this.prisma.budget.findFirst({
      where: { organizationId, fiscalYearId: input.fiscalYearId, name: input.name },
    });
    if (existing) {
      return err({
        code: "DUPLICATE_NAME",
        message: `En budget med namnet "${input.name}" finns redan för detta räkenskapsår`,
      });
    }

    const budget = await this.prisma.budget.create({
      data: {
        organizationId,
        fiscalYearId: input.fiscalYearId,
        name: input.name,
        entries: {
          create: input.entries.map((e) => ({
            accountNumber: e.accountNumber,
            month: e.month,
            amount: e.amount,
          })),
        },
      },
      include: includeEntries,
    });

    return ok(toBudget(budget));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateBudgetInput,
  ): Promise<Result<Budget, BudgetError>> {
    const existing = await this.prisma.budget.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Budgeten hittades inte" });
    }

    // If name is being changed, check for duplicate
    if (input.name != null && input.name !== existing.name) {
      const duplicate = await this.prisma.budget.findFirst({
        where: {
          organizationId,
          fiscalYearId: existing.fiscalYearId,
          name: input.name,
          id: { not: id },
        },
      });
      if (duplicate) {
        return err({
          code: "DUPLICATE_NAME",
          message: `En budget med namnet "${input.name}" finns redan för detta räkenskapsår`,
        });
      }
    }

    const budget = await this.prisma.$transaction(async (tx) => {
      // Delete old entries if replacing
      if (input.entries != null) {
        await tx.budgetEntry.deleteMany({ where: { budgetId: id } });
      }

      return tx.budget.update({
        where: { id },
        data: {
          ...(input.name != null && { name: input.name }),
          ...(input.entries != null && {
            entries: {
              create: input.entries.map((e) => ({
                accountNumber: e.accountNumber,
                month: e.month,
                amount: e.amount,
              })),
            },
          }),
        },
        include: includeEntries,
      });
    });

    return ok(toBudget(budget));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId },
    });
    if (!budget) return false;

    await this.prisma.budget.delete({ where: { id } });
    return true;
  }
}
