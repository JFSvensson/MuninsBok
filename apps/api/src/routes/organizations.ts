import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { BAS_SIMPLIFIED } from "@muninsbok/core/chart-of-accounts";
import { isValidOrgNumber } from "@muninsbok/core/types";
import {
  createOrganizationSchema,
  deleteOrganizationSchema,
  updateOrganizationSchema,
} from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

export async function organizationRoutes(fastify: FastifyInstance) {
  const orgRepo = fastify.repos.organizations;

  async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
    const membership = request.membership;
    if (!membership) {
      return reply.status(401).send({
        error: "Autentisering krävs",
        code: "UNAUTHORIZED",
      });
    }

    if (membership.role !== "OWNER") {
      return reply.status(403).send({
        error: "Rollen OWNER eller högre krävs",
        code: "INSUFFICIENT_ROLE",
      });
    }
  }

  // List organizations (filtered by membership when authenticated)
  fastify.get("/", async (request) => {
    const userId = request.user?.sub;
    if (userId) {
      const organizations = await orgRepo.findByUserMembership(userId);
      return { data: organizations };
    }
    return { data: [] };
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

    const userId = request.user?.sub;
    const result = await orgRepo.createWithInitialData(
      {
        ...rest,
        ...(fiscalYearStartMonth != null && { fiscalYearStartMonth }),
      },
      BAS_SIMPLIFIED.map((a) => ({
        number: a.number,
        name: a.name,
        type: a.type,
        isVatAccount: a.isVatAccount,
      })),
      userId,
    );
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    const org = result.value;
    return reply.status(201).send({ data: org });
  });

  // Update organization
  fastify.patch<{ Params: { orgId: string } }>(
    "/:orgId",
    { preHandler: [requireOwner] },
    async (request, reply) => {
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
    },
  );

  // Delete organization
  fastify.delete<{ Params: { orgId: string } }>(
    "/:orgId",
    { preHandler: [requireOwner] },
    async (request, reply) => {
      const evidence = parseBody(deleteOrganizationSchema, request.body);
      const deleted = await orgRepo.delete(request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Organisationen hittades inte" });
      }
      request.log.info(
        {
          audit: true,
          action: "ORGANIZATION_DELETED",
          organizationId: request.params.orgId,
          userId: request.user?.sub ?? null,
          exportOrBackupConfirmed: evidence.exportOrBackupConfirmed,
          exportOrBackupType: evidence.exportOrBackupType,
          exportOrBackupReference: evidence.exportOrBackupReference,
        },
        "audit: organization deleted after export or backup attestation",
      );
      return reply.status(204).send();
    },
  );
}
