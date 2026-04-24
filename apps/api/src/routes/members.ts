/**
 * Organization member management routes.
 *
 * GET    /:orgId/members          — list members (any member)
 * POST   /:orgId/members          — add member (ADMIN+)
 * PATCH  /:orgId/members/:userId  — change role (ADMIN+)
 * DELETE /:orgId/members/:userId  — remove member (ADMIN+)
 */
import type { FastifyInstance } from "fastify";
import type { MemberRole } from "@muninsbok/core/types";
import { addMemberSchema, updateMemberRoleSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

const ROLE_LEVEL: Record<MemberRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

export async function memberRoutes(fastify: FastifyInstance) {
  const userRepo = fastify.repos.users;

  // List members — any member of the org can view
  fastify.get<{ Params: { orgId: string } }>("/:orgId/members", async (request) => {
    const members = await userRepo.findMembersByOrganization(request.params.orgId);
    return { data: members };
  });

  // Add member — requires ADMIN or higher
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/members",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const { email, role } = parseBody(addMemberSchema, request.body);
      const requesterRole = request.membership?.role;

      if (requesterRole && ROLE_LEVEL[role] > ROLE_LEVEL[requesterRole]) {
        return reply.status(403).send({
          error: "Du kan inte tilldela en högre roll än din egen",
          code: "INSUFFICIENT_ROLE_ASSIGNMENT",
        });
      }

      const user = await userRepo.findByEmail(email);
      if (!user) {
        return reply.status(404).send({
          error: "Användaren hittades inte",
          code: "USER_NOT_FOUND",
        });
      }

      // Check if already a member
      const existing = await userRepo.findMembership(user.id, request.params.orgId);
      if (existing) {
        return reply.status(409).send({
          error: "Användaren är redan medlem i organisationen",
          code: "ALREADY_MEMBER",
        });
      }

      const member = await userRepo.addMember(user.id, request.params.orgId, role);
      return reply.status(201).send({ data: member });
    },
  );

  // Update member role — requires ADMIN or higher
  fastify.patch<{ Params: { orgId: string; userId: string } }>(
    "/:orgId/members/:userId",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const { role } = parseBody(updateMemberRoleSchema, request.body);
      const requesterRole = request.membership?.role;

      if (requesterRole && ROLE_LEVEL[role] > ROLE_LEVEL[requesterRole]) {
        return reply.status(403).send({
          error: "Du kan inte tilldela en högre roll än din egen",
          code: "INSUFFICIENT_ROLE_ASSIGNMENT",
        });
      }

      const updated = await userRepo.updateMemberRole(
        request.params.userId,
        request.params.orgId,
        role,
      );
      if (!updated) {
        return reply.status(404).send({
          error: "Medlemskapet hittades inte",
          code: "MEMBER_NOT_FOUND",
        });
      }

      return { data: updated };
    },
  );

  // Remove member — requires ADMIN or higher
  fastify.delete<{ Params: { orgId: string; userId: string } }>(
    "/:orgId/members/:userId",
    { preHandler: [fastify.requireRole("ADMIN")] },
    async (request, reply) => {
      const removed = await userRepo.removeMember(request.params.userId, request.params.orgId);
      if (!removed) {
        return reply.status(404).send({
          error: "Medlemskapet hittades inte",
          code: "MEMBER_NOT_FOUND",
        });
      }
      return reply.status(204).send();
    },
  );
}
