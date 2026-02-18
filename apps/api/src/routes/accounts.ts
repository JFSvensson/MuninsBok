import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACCOUNT_NUMBER_PATTERN } from "@muninsbok/core";

const createAccountSchema = z.object({
  number: z.string().regex(ACCOUNT_NUMBER_PATTERN, "Kontonummer måste vara 4 siffror (1000-8999)"),
  name: z.string().min(1).max(255),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  isVatAccount: z.boolean().optional(),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
  isVatAccount: z.boolean().optional(),
});

export async function accountRoutes(fastify: FastifyInstance) {
  const accountRepo = fastify.repos.accounts;

  // List accounts for organization
  fastify.get<{
    Params: { orgId: string };
    Querystring: { active?: string };
  }>("/:orgId/accounts", async (request) => {
    const { orgId } = request.params;
    const activeOnly = request.query.active === "true";

    const accounts = activeOnly
      ? await accountRepo.findActive(orgId)
      : await accountRepo.findByOrganization(orgId);

    return { data: accounts };
  });

  // Get single account
  fastify.get<{ Params: { orgId: string; accountNumber: string } }>(
    "/:orgId/accounts/:accountNumber",
    async (request, reply) => {
      const account = await accountRepo.findByNumber(
        request.params.orgId,
        request.params.accountNumber
      );
      if (!account) {
        return reply.status(404).send({ error: "Kontot hittades inte" });
      }
      return { data: account };
    }
  );

  // Create account
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/accounts",
    async (request, reply) => {
      const parsed = createAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues });
      }

      const { isVatAccount, ...rest } = parsed.data;
      const result = await accountRepo.create(request.params.orgId, {
        ...rest,
        ...(isVatAccount != null && { isVatAccount }),
      });

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );

  // Deactivate account
  fastify.delete<{ Params: { orgId: string; accountNumber: string } }>(
    "/:orgId/accounts/:accountNumber",
    async (request, reply) => {
      const deactivated = await accountRepo.deactivate(
        request.params.orgId,
        request.params.accountNumber
      );
      if (!deactivated) {
        return reply.status(404).send({ error: "Kontot hittades inte" });
      }
      return reply.status(204).send();
    }
  );

  // Update account
  fastify.put<{ Params: { orgId: string; accountNumber: string } }>(
    "/:orgId/accounts/:accountNumber",
    async (request, reply) => {
      const parsed = updateAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues });
      }

      const { name, type, isVatAccount } = parsed.data;
      const result = await accountRepo.update(
        request.params.orgId,
        request.params.accountNumber,
        {
          ...(name != null && { name }),
          ...(type != null && { type }),
          ...(isVatAccount != null && { isVatAccount }),
        },
      );

      if (!result.ok) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({ error: result.error });
      }

      return { data: result.value };
    }
  );
}
