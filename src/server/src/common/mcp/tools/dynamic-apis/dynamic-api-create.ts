import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDynamicApiCreate(server: McpServer) {
  server.registerTool(
    "dynamic_api_create",
    {
      description:
        "Create a new dynamic API endpoint. The code runs in a JavaScript sandbox with access to request data and a logging context. " +
        "The handler function receives (request, context) and must return { status, headers?, body }.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(255)
          .describe("API endpoint name (e.g. 'Get Users', 'Create Order')"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .describe("HTTP method"),
        path: z
          .string()
          .min(1)
          .max(500)
          .describe("API path starting with /. Supports :param for path params (e.g. '/users/:id')"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Optional description of the endpoint"),
        code: z
          .string()
          .describe(
            "JavaScript handler code. Must export a default async function. " +
            "Signature: handler(request, context). " +
            "request: { method, path, params, query, headers, body }. " +
            "context: { log }. " +
            "Return: { status, headers?, body }. " +
            'Example: export default async function handler(req, ctx) { return { status: 200, body: { ok: true } }; }',
          ),
        isPublic: z
          .boolean()
          .optional()
          .describe("If true, endpoint is accessible without authentication (default: false)"),
        timeout: z
          .number()
          .int()
          .min(1000)
          .max(300000)
          .optional()
          .describe("Execution timeout in milliseconds (1000–300000, default: 30000)"),
      },
    },
    async ({ name, method, path, description, code, isPublic, timeout }) => {
      try {
        const { createDynamicApi } = await import(
          "../../../../modules/dynamic-apis/dynamic-api.service.js"
        );
        const result = await createDynamicApi(
          { name, method, path, description, code, isPublic: isPublic ?? false, timeout: timeout ?? 30000 },
          "usr_mcp_system",
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal error";
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    },
  );
}
