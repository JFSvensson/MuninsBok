import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BAS_SIMPLIFIED, isValidOrgNumber } from "@muninsbok/core";

const createOrganizationSchema = z.object({
  orgNumber: z.string().min(10).max(12),
  name: z.string().min(1).max(255),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

export async function organizationRoutes(fastify: FastifyInstance) {
  const orgRepo = fastify.repos.organizations;
  const accountRepo = fastify.repos.accounts;

  // List all organizations
  fastify.get("/", async () => {
    const organizations = await orgRepo.findAll();
    return { data: organizations };
  });

  // Get single organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId", async (request, reply) => {
    const org = await orgRepo.findById(request.params.orgId);
    if (!org) {
      return reply.status(404).send({ error: "Organisationen hittades inte" });
    }
    return { data: org };
  });

  // Create organization
  fastify.post("/", async (request, reply) => {
    const parsed = createOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { fiscalYearStartMonth, ...rest } = parsed.data;

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

    return reply.status(201).send({ data: org });
  });

  // Update organization
  fastify.patch<{ Params: { orgId: string } }>("/:orgId", async (request, reply) => {
    const parsed = updateOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues });
    }

    const { name, fiscalYearStartMonth } = parsed.data;
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
