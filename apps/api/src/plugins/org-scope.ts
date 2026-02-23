/**
 * Org-scope type augmentation.
 *
 * The preHandler hook that validates `:orgId` is defined inline in app.ts
 * to avoid Fastify encapsulation issues. This module provides the type
 * augmentation for `request.org`.
 */
import type { Organization } from "@muninsbok/core/types";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the org-scope preHandler for routes with `:orgId`. */
    org?: Organization;
  }
}
