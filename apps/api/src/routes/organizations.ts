import type { FastifyInstance } from "fastify";
import { BAS_SIMPLIFIED } from "@muninsbok/core/chart-of-accounts";
import { isValidOrgNumber } from "@muninsbok/core/types";
import { createOrganizationSchema, updateOrganizationSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

export async function organizationRoutes(fastify: FastifyInstance) {
  const orgRepo = fastify.repos.organizations;
  const accountRepo = fastify.repos.accounts;
  const userRepo = fastify.repos.users;

  // List organizations (filtered by membership when authenticated)
  fastify.get("/", async (request) => {
    const userId = request.user?.sub;
    if (userId) {
      const organizations = await orgRepo.findByUserMembership(userId);
      return { data: organizations };
    }
    const organizations = await orgRepo.findAll();
    return { data: organizations };
  });

  // Get single organization (org validated by preHandler hook)
  fastify.get<{ Params: { orgId: string } }>("/:orgId", async (request) => {
    return { data: request.org };
  });

  // Create organization
  fastify.post("/", async (request, reply) => {
    const parsed = parseBody(createOrganizationSchema, request.body);

    const { fiscalYearStartMonth, ...rest } = parsed;

    if (!isValidOrgNumber(rest.orgNumber)) {
      return reply.status(400).send({
        error: "Ogiltigt organisationsnummer (kontrollsiffran stämmer inte)",
      });
    }

    const result = await orgRepo.create({
      ...rest,
      ...(fiscalYearStartMonth != null && { fiscalYearStartMonth }),
    });
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    // Initialize with BAS simplified chart of accounts
    const org = result.value;
    await accountRepo.createMany(
      org.id,
      BAS_SIMPLIFIED.map((a) => ({
        number: a.number,
        name: a.name,
        type: a.type,
        isVatAccount: a.isVatAccount,
      })),
    );

    // Auto-assign creator as OWNER
    const userId = request.user?.sub;
    if (userId) {
      await userRepo.addMember(userId, org.id, "OWNER");
    }

    return reply.status(201).send({ data: org });
  });

  // Update organization
  fastify.patch<{ Params: { orgId: string } }>("/:orgId", async (request, reply) => {
    const parsed = parseBody(updateOrganizationSchema, request.body);

    const { name, fiscalYearStartMonth } = parsed;
    const org = await orgRepo.update(request.params.orgId, {
      ...(name != null && { name }),
      ...(fiscalYearStartMonth != null && { fiscalYearStartMonth }),
    });
    if (!org) {
      return reply.status(404).send({ error: "Organisationen hittades inte" });
    }
    return { data: org };
  });

  // Delete organization
  fastify.delete<{ Params: { orgId: string } }>("/:orgId", async (request, reply) => {
    const deleted = await orgRepo.delete(request.params.orgId);
    if (!deleted) {
      return reply.status(404).send({ error: "Organisationen hittades inte" });
    }
    return reply.status(204).send();
  });
}
