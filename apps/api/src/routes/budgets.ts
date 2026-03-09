import type { FastifyInstance } from "fastify";
import type { UpdateBudgetInput } from "@muninsbok/core/types";
import type { BudgetVsActualRow, BudgetVsActualReport } from "@muninsbok/core/api-types";
import { createBudgetSchema, updateBudgetSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import { öreToKronor } from "../utils/amount-conversion.js";

export async function budgetRoutes(fastify: FastifyInstance) {
  const budgetRepo = fastify.repos.budgets;

  // List budgets for a fiscal year
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId?: string };
  }>("/:orgId/budgets", async (request, reply) => {
    const { fiscalYearId } = request.query;
    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }
    const budgets = await budgetRepo.findByFiscalYear(request.params.orgId, fiscalYearId);
    return { data: budgets };
  });

  // Get single budget
  fastify.get<{ Params: { orgId: string; budgetId: string } }>(
    "/:orgId/budgets/:budgetId",
    async (request, reply) => {
      const budget = await budgetRepo.findById(request.params.budgetId, request.params.orgId);
      if (!budget) {
        return reply.status(404).send({ error: "Budgeten hittades inte" });
      }
      return { data: budget };
    },
  );

  // Create budget
  fastify.post<{ Params: { orgId: string } }>("/:orgId/budgets", async (request, reply) => {
    const parsed = parseBody(createBudgetSchema, request.body);

    const result = await budgetRepo.create(request.params.orgId, {
      fiscalYearId: parsed.fiscalYearId,
      name: parsed.name,
      entries: parsed.entries.map((e) => ({
        accountNumber: e.accountNumber,
        month: e.month,
        amount: e.amount,
      })),
    });

    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
      return reply.status(status).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Update budget
  fastify.put<{ Params: { orgId: string; budgetId: string } }>(
    "/:orgId/budgets/:budgetId",
    async (request, reply) => {
      const parsed = parseBody(updateBudgetSchema, request.body);

      const input: UpdateBudgetInput = {
        ...(parsed.name != null && { name: parsed.name }),
        ...(parsed.entries != null && {
          entries: parsed.entries.map((e) => ({
            accountNumber: e.accountNumber,
            month: e.month,
            amount: e.amount,
          })),
        }),
      };

      const result = await budgetRepo.update(request.params.budgetId, request.params.orgId, input);

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return { data: result.value };
    },
  );

  // Delete budget
  fastify.delete<{ Params: { orgId: string; budgetId: string } }>(
    "/:orgId/budgets/:budgetId",
    async (request, reply) => {
      const deleted = await budgetRepo.delete(request.params.budgetId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Budgeten hittades inte" });
      }
      return reply.status(204).send();
    },
  );

  // Budget vs Actual report
  fastify.get<{
    Params: { orgId: string; budgetId: string };
    Querystring: { startDate?: string; endDate?: string };
  }>("/:orgId/budgets/:budgetId/vs-actual", async (request, reply) => {
    const { orgId, budgetId } = request.params;

    const budget = await budgetRepo.findById(budgetId, orgId);
    if (!budget) {
      return reply.status(404).send({ error: "Budgeten hittades inte" });
    }

    // Fetch vouchers and accounts in parallel
    const [vouchers, accounts] = await Promise.all([
      fastify.repos.vouchers.findByFiscalYear(budget.fiscalYearId, orgId),
      fastify.repos.accounts.findByOrganization(orgId),
    ]);

    // Optional date filtering
    const { startDate, endDate } = request.query;
    const filtered = vouchers.filter((v) => {
      const d = v.date instanceof Date ? v.date : new Date(v.date);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate)) return false;
      return true;
    });

    // Build account name lookup
    const accountNameMap = new Map(accounts.map((a) => [a.number, a.name]));

    // Sum budgeted amounts per account (all months)
    const budgetByAccount = new Map<string, number>();
    for (const entry of budget.entries) {
      budgetByAccount.set(
        entry.accountNumber,
        (budgetByAccount.get(entry.accountNumber) ?? 0) + entry.amount,
      );
    }

    // Sum actual amounts per account from voucher lines (debit - credit)
    const actualByAccount = new Map<string, number>();
    for (const voucher of filtered) {
      for (const line of voucher.lines) {
        actualByAccount.set(
          line.accountNumber,
          (actualByAccount.get(line.accountNumber) ?? 0) + line.debit - line.credit,
        );
      }
    }

    // Collect all account numbers that appear in budget or actuals
    const allAccounts = new Set([...budgetByAccount.keys(), ...actualByAccount.keys()]);

    const rows: BudgetVsActualRow[] = [...allAccounts].sort().map((accountNumber) => {
      const budgetÖre = budgetByAccount.get(accountNumber) ?? 0;
      const actualÖre = actualByAccount.get(accountNumber) ?? 0;
      const deviationÖre = actualÖre - budgetÖre;

      return {
        accountNumber,
        accountName: accountNameMap.get(accountNumber) ?? accountNumber,
        budget: öreToKronor(budgetÖre),
        actual: öreToKronor(actualÖre),
        deviation: öreToKronor(deviationÖre),
        deviationPercent: budgetÖre !== 0 ? (deviationÖre / budgetÖre) * 100 : null,
      };
    });

    const totalBudget = [...budgetByAccount.values()].reduce((sum, v) => sum + v, 0);
    const totalActual = [...actualByAccount.values()].reduce((sum, v) => sum + v, 0);

    const report: BudgetVsActualReport = {
      budgetId: budget.id,
      budgetName: budget.name,
      rows,
      totalBudget: öreToKronor(totalBudget),
      totalActual: öreToKronor(totalActual),
      totalDeviation: öreToKronor(totalActual - totalBudget),
      generatedAt: new Date().toISOString(),
    };

    return { data: report };
  });
}
