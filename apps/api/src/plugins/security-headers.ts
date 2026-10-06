/**
 * Security headers plugin — replaces @fastify/helmet with only the headers
 * this API actually needs. CSP directives are configured in app.ts.
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export interface SecurityHeadersOptions {
  /** CSP directives as camelCase keys with value lists (e.g. defaultSrc: ["'self'"]). */
  contentSecurityPolicy?: {
    directives: Record<string, string[]>;
  };
}

function kebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function buildCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${kebabCase(key)} ${values.join(" ")}`)
    .join("; ");
}

const securityHeadersPlugin: FastifyPluginAsync<SecurityHeadersOptions> = async (
  fastify,
  options,
) => {
  const csp = options.contentSecurityPolicy
    ? buildCsp(options.contentSecurityPolicy.directives)
    : "default-src 'self'";

  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "SAMEORIGIN");
    reply.header("content-security-policy", csp);
    reply.removeHeader("x-powered-by");
  });
};

export default fp(securityHeadersPlugin, { name: "security-headers" });
