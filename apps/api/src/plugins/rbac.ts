/**
 * RBAC (Role-Based Access Control) plugin.
 *
 * Provides `requireMembership` and `requireRole` preHandlers that verify
 * the authenticated user's membership and role in the target organization.
 *
 * Role hierarchy: OWNER > ADMIN > MEMBER
 *
 * Usage:
 *   instance.addHook("preHandler", instance.requireMembership);
 *   // or for write-operations:
 *   fastify.delete("/:orgId", { preHandler: [fastify.requireRole("ADMIN")] }, handler);
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { MemberRole, OrganizationMember } from "@muninsbok/core/types";
import type { JwtPayload } from "./jwt-auth.js";

/** Role hierarchy — higher index = more privileges. */
const ROLE_LEVEL: Record<MemberRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

async function rbac(fastify: FastifyInstance): Promise<void> {
  /**
   * PreHandler: verify the user is a member of the org identified by `:orgId`.
   * Sets `request.membership` for downstream use.
   */
  fastify.decorate(
    "requireMembership",
    async function requireMembership(request: FastifyRequest, reply: FastifyReply) {
      const orgId = (request.params as Record<string, string | undefined>)["orgId"];
      if (!orgId) return; // List / create routes don't have orgId

      const user = request.user as JwtPayload | undefined;
      if (!user?.sub) {
        return reply.status(401).send({
          error: "Autentisering krävs",
          code: "UNAUTHORIZED",
        });
      }

      const membership = await fastify.repos.users.findMembership(user.sub, orgId);
      if (!membership) {
        return reply.status(403).send({
          error: "Du är inte medlem i denna organisation",
          code: "FORBIDDEN",
        });
      }

      request.membership = membership;
    },
  );

  /**
   * Factory: create a preHandler that requires a minimum role.
   * Must be used after `requireMembership` (or `authenticate` + org-scope).
   */
  fastify.decorate("requireRole", function requireRole(minRole: MemberRole) {
    return async function checkRole(request: FastifyRequest, reply: FastifyReply) {
      const membership = request.membership;
      if (!membership) {
        return reply.status(403).send({
          error: "Du är inte medlem i denna organisation",
          code: "FORBIDDEN",
        });
      }

      if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[minRole]) {
        return reply.status(403).send({
          error: `Rollen ${minRole} eller högre krävs`,
          code: "INSUFFICIENT_ROLE",
        });
      }
    };
  });
}

export default fp(rbac, { name: "rbac" });

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    requireMembership: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      minRole: MemberRole,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    /** Set by requireMembership preHandler. */
    membership?: OrganizationMember;
  }
}
