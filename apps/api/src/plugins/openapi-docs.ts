/**
 * Minimal OpenAPI docs plugin — replaces @fastify/swagger + @fastify/swagger-ui.
 *
 * Routes do not declare Fastify schemas (validation is done with zod in
 * handlers), so the generated document is a skeleton: openapi info, tags,
 * and every registered route as a path with empty descriptions. That matches
 * what @fastify/swagger produced for this API.
 */
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

export interface OpenapiDocsOptions {
  openapi: {
    info: { title: string; description: string; version: string };
    tags?: { name: string; description: string }[];
  };
  /** Route prefix where docs are served, e.g. "/docs". */
  routePrefix: string;
}

const SWAGGER_UI_VERSION = "5.11.0";

function buildSwaggerUiHtml(specUrl: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <title>${title} — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: "#swagger-ui" });
  </script>
</body>
</html>`;
}

const openapiDocsPlugin: FastifyPluginAsync<OpenapiDocsOptions> = async (fastify, options) => {
  const prefix = options.routePrefix;

  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

  function convertPath(url: string): string {
    // Fastify :param -> OpenAPI {param}; strip any regex suffix (:id(\\d+))
    return url.replace(/:([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?/g, "{$1}");
  }

  fastify.get(`${prefix}/json`, async () => {
    // printRoutes() renders the radix tree, e.g. "└── /api/organizations (GET)\n"
    const tree = fastify.printRoutes({ includeHooks: false, commonPrefix: false });
    const paths: Record<string, Record<string, unknown>> = {};

    for (const line of tree.split("\n")) {
      // Format: "├── /a (GET, HEAD)" or "└── /b/:id (POST)"
      const match = /^[├└│\s]*──\s+(.+?)\s+\(([^)]+)\)\s*$/.exec(line.trim());
      const rawUrl = match?.[1];
      const methodList = match?.[2];
      if (!rawUrl || !methodList) continue;

      const path = convertPath(rawUrl);
      const pathItem = (paths[path] ??= {});
      for (const method of methodList.split(", ")) {
        if (!(METHODS as readonly string[]).includes(method)) continue;
        pathItem[method.toLowerCase()] = { responses: { 200: { description: "" } } };
      }
    }

    return {
      openapi: "3.0.3",
      info: options.openapi.info,
      ...(options.openapi.tags && { tags: options.openapi.tags }),
      paths,
    };
  });

  fastify.get(prefix, async (_request, reply) => {
    reply.redirect(`${prefix}/`);
  });

  fastify.get(`${prefix}/`, async (_request, reply) => {
    reply.type("text/html").send(buildSwaggerUiHtml(`${prefix}/json`, options.openapi.info.title));
  });
};

export default fp(openapiDocsPlugin, { name: "openapi-docs" });
