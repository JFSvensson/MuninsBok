/**
 * Minimal cookie plugin — replaces @fastify/cookie for this API's needs:
 * parse the Cookie header into request.cookies, plus reply.setCookie /
 * reply.clearCookie with the standard attributes used for the refresh token.
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export interface CookieSerializeOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  expires?: Date;
  maxAge?: number;
}

declare module "fastify" {
  interface FastifyRequest {
    cookies: Record<string, string>;
  }
  interface FastifyReply {
    setCookie(name: string, value: string, options?: CookieSerializeOptions): FastifyReply;
    clearCookie(name: string, options?: CookieSerializeOptions): FastifyReply;
  }
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function serializeCookie(name: string, value: string, options: CookieSerializeOptions): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.httpOnly) segments.push("HttpOnly");
  if (options.secure) segments.push("Secure");
  if (options.sameSite) {
    const v = options.sameSite;
    segments.push(`SameSite=${v.charAt(0).toUpperCase()}${v.slice(1)}`);
  }
  return segments.join("; ");
}

const cookiePlugin: FastifyPluginAsync = async (fastify) => {
  // Fastify requires a getter/setter pair for reference-type request decorators.
  fastify.decorateRequest("cookies", {
    getter(this: FastifyRequest) {
      return parseCookieHeader(this.raw.headers.cookie);
    },
  });

  fastify.decorateReply(
    "setCookie",
    function (
      this: FastifyReply,
      name: string,
      value: string,
      options: CookieSerializeOptions = {},
    ): FastifyReply {
      const serialized = serializeCookie(name, value, options);
      const existing = this.getHeader("set-cookie");
      const values =
        existing == null ? [] : Array.isArray(existing) ? existing : [String(existing)];
      this.header("set-cookie", [...values, serialized]);
      return this;
    },
  );

  fastify.decorateReply(
    "clearCookie",
    function (
      this: FastifyReply,
      name: string,
      options: CookieSerializeOptions = {},
    ): FastifyReply {
      return this.setCookie(name, "", { ...options, expires: new Date(0), maxAge: 0 });
    },
  );
};

export default fp(cookiePlugin, { name: "cookie" });
