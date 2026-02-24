import type { FastifyInstance } from "fastify";
import { createAccountSchema, updateAccountSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

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
        request.params.accountNumber,
      );
      if (!account) {
        return reply.status(404).send({ error: "Kontot hittades inte" });
      }
      return { data: account };
    },
  );

  // Create account
  fastify.post<{ Params: { orgId: string } }>("/:orgId/accounts", async (request, reply) => {
    const parsed = parseBody(createAccountSchema, request.body);

    const { isVatAccount, ...rest } = parsed;
    const result = await accountRepo.create(request.params.orgId, {
      ...rest,
      ...(isVatAccount != null && { isVatAccount }),
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Deactivate account
  fastify.delete<{ Params: { orgId: string; accountNumber: string } }>(
    "/:orgId/accounts/:accountNumber",
    async (request, reply) => {
      const deactivated = await accountRepo.deactivate(
        request.params.orgId,
        request.params.accountNumber,
      );
      if (!deactivated) {
        return reply.status(404).send({ error: "Kontot hittades inte" });
      }
      return reply.status(204).send();
    },
  );

  // Update account
  fastify.put<{ Params: { orgId: string; accountNumber: string } }>(
    "/:orgId/accounts/:accountNumber",
    async (request, reply) => {
      const parsed = parseBody(updateAccountSchema, request.body);

      const { name, type, isVatAccount } = parsed;
      const result = await accountRepo.update(request.params.orgId, request.params.accountNumber, {
        ...(name != null && { name }),
        ...(type != null && { type }),
        ...(isVatAccount != null && { isVatAccount }),
      });

      if (!result.ok) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({ error: result.error });
      }

      return { data: result.value };
    },
  );
}
