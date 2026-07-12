import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth, requireAdmin, extractAuthToken } from "../../common/auth/middleware.js";
import { executeMcpTool } from "./utils/executor.js";
import {
  createMcpServerBodySchema,
  updateMcpServerBodySchema,
  createMcpToolBodySchema,
  updateMcpToolBodySchema,
  testMcpToolBodySchema,
  listMcpToolsQuerySchema,
} from "./common/schema.js";
import type {
  CreateMcpServerBody,
  UpdateMcpServerBody,
  CreateMcpToolBody,
  UpdateMcpToolBody,
  ListMcpToolsQuery,
} from "./common/schema.js";
import {
  listMcpServers,
  getMcpServerById,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  isBuiltinServer,
  listMcpTools,
  getMcpToolById,
  createMcpTool,
  updateMcpTool,
  deleteMcpTool,
  createMcpToolLog,
  listMcpToolLogs,
  regenerateMcpServerApiKey,
  revokeMcpServerApiKey,
} from "./mcp-tool-server.service.js";
import { runMcpCodingAgent, type McpAgentEvent } from "./utils/coding.js";

// ── Server Routes ───────────────────────────────────────────────────────────

export function registerMcpServerRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET / — list all MCP servers
  r.get("/", { preHandler: [requireAuth] }, async (_req, reply) => {
    const result = await listMcpServers();
    return reply.send(result);
  });

  // GET /:id — get server by ID
  r.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const server = await getMcpServerById(id);
    if (!server) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });
    return reply.send(server);
  });

  // POST / — create custom server
  r.post(
    "/",
    { preHandler: [requireAuth], schema: { body: createMcpServerBodySchema } },
    async (req, reply) => {
      const server = await createMcpServer(req.body as CreateMcpServerBody);
      return reply.code(201).send(server);
    },
  );

  // PATCH /:id — update server
  r.patch(
    "/:id",
    { preHandler: [requireAuth], schema: { body: updateMcpServerBodySchema } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await getMcpServerById(id);
      if (!existing) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

      const data = req.body as UpdateMcpServerBody;
      if (isBuiltinServer(id) && data.name !== undefined) {
        return reply.code(403).send({ error: "forbidden", message: "Cannot rename built-in server" });
      }

      const updated = await updateMcpServer(id, data);
      return reply.send(updated);
    },
  );

  // DELETE /:id — delete server
  r.delete("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (isBuiltinServer(id)) {
      return reply.code(403).send({ error: "forbidden", message: "Cannot delete built-in server" });
    }

    const existing = await getMcpServerById(id);
    if (!existing) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

    await deleteMcpServer(id);
    return reply.send({ id, deleted: true });
  });

  const codingAgentBodySchema = z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    prompt: z.string().min(1),
    currentCode: z.string().default(""),
    serverId: z.string().min(1),
    toolId: z.string().min(1),
    toolName: z.string().default(""),
    toolDescription: z.string().default(""),
    inputSchema: z.string().default(""),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).default([]),
  });

  r.post(
    "/coding-agent",
    {
      preHandler: [requireAuth],
      schema: { body: codingAgentBodySchema },
    },
    async (req, reply) => {
      const input = req.body as z.infer<typeof codingAgentBodySchema>;
      const authToken = extractAuthToken(req);

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: McpAgentEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        await runMcpCodingAgent({ ...input, authToken }, sendEvent);
        reply.raw.write(`data: ${JSON.stringify({ type: "stream_end" })}\n\n`);
      } catch (err: unknown) {
        console.error("[McpCodingAgent] Error:", err);
        const message = err instanceof Error ? err.message : "Agent failed";
        reply.raw.write(
          `data: ${JSON.stringify({ type: "error", message })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }
    },
  );

  r.post("/:id/regenerate-key", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await getMcpServerById(id);
    if (!existing) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

    const result = await regenerateMcpServerApiKey(id);
    return reply.send(result);
  });

  r.delete("/:id/api-key", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await getMcpServerById(id);
    if (!existing) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

    await revokeMcpServerApiKey(id);
    return reply.send({ id, revoked: true });
  });
}

export function registerMcpToolRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/",
    { preHandler: [requireAuth], schema: { querystring: listMcpToolsQuerySchema } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const server = await getMcpServerById(id);
      if (!server) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

      const query = req.query as ListMcpToolsQuery;
      const result = await listMcpTools(id, query);
      return reply.send(result);
    },
  );

  r.get("/:toolId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, toolId } = req.params as { id: string; toolId: string };
    const tool = await getMcpToolById(toolId);
    if (!tool || tool.serverId !== id) {
      return reply.code(400).send({ error: "not_found", message: "Tool not found" });
    }
    return reply.send(tool);
  });

  r.post(
    "/",
    { preHandler: [requireAuth], schema: { body: createMcpToolBodySchema } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const server = await getMcpServerById(id);
      if (!server) return reply.code(400).send({ error: "not_found", message: "MCP server not found" });

      if (isBuiltinServer(id)) {
        return reply.code(403).send({ error: "forbidden", message: "Cannot add tools to built-in server" });
      }

      try {
        const tool = await createMcpTool(id, req.body as CreateMcpToolBody);
        return reply.code(201).send(tool);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create tool";
        return reply.code(400).send({ error: "bad_request", message: msg });
      }
    },
  );

  r.patch(
    "/:toolId",
    { preHandler: [requireAuth], schema: { body: updateMcpToolBodySchema } },
    async (req, reply) => {
      const { id, toolId } = req.params as { id: string; toolId: string };
      const tool = await getMcpToolById(toolId);
      if (!tool || tool.serverId !== id) {
        return reply.code(400).send({ error: "not_found", message: "Tool not found" });
      }

      if (isBuiltinServer(id)) {
        const data = req.body as UpdateMcpToolBody;
        const nonToggleKeys = Object.keys(data).filter((k) => k !== "isActive");
        if (nonToggleKeys.length > 0) {
          return reply.code(403).send({ error: "forbidden", message: "Cannot edit built-in server tools" });
        }
      }

      try {
        const updated = await updateMcpTool(id, toolId, req.body as UpdateMcpToolBody);
        return reply.send(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update tool";
        return reply.code(400).send({ error: "bad_request", message: msg });
      }
    },
  );

  r.delete("/:toolId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, toolId } = req.params as { id: string; toolId: string };
    if (isBuiltinServer(id)) {
      return reply.code(403).send({ error: "forbidden", message: "Cannot delete built-in server tools" });
    }

    const tool = await getMcpToolById(toolId);
    if (!tool || tool.serverId !== id) {
      return reply.code(400).send({ error: "not_found", message: "Tool not found" });
    }

    await deleteMcpTool(toolId);
    return reply.send({ id: toolId, deleted: true });
  });

  r.get("/:toolId/logs", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, toolId } = req.params as { id: string; toolId: string };
    const { page, limit } = req.query as { page?: string; limit?: string };
    const tool = await getMcpToolById(toolId);
    if (!tool || tool.serverId !== id) {
      return reply.code(400).send({ error: "not_found", message: "Tool not found" });
    }
    const result = await listMcpToolLogs(toolId, Number(page ?? 1), Number(limit ?? 50));
    return reply.send(result);
  });

  r.post(
    "/:toolId/test",
    { preHandler: [requireAuth], schema: { body: testMcpToolBodySchema } },
    async (req, reply) => {
      const { id: serverId, toolId } = req.params as { id: string; toolId: string };
      const tool = await getMcpToolById(toolId);
      if (!tool || tool.serverId !== serverId) {
        return reply.code(400).send({ error: "not_found", message: "Tool not found" });
      }

      const body = req.body as { params?: Record<string, unknown>; source?: "prod" | "draft" };
      const codeToTest = body.source === "prod" ? tool.code : (tool.draftCode ?? tool.code);
      const authToken = extractAuthToken(req);

      const result = await executeMcpTool(
        tool.id,
        codeToTest,
        body.params ?? {},
        {
          timeoutMs: 30_000,
          baseUrl: `http://127.0.0.1:${process.env.PORT ?? "5610"}`,
          authToken,
        },
      );

      createMcpToolLog({
        toolId: tool.id,
        serverId,
        callerType: "test_panel",
        callerInfo: req.auth?.userId,
        inputParams: body.params ?? {},
        outputResult: result.result,
        status: result.success ? "success" : "error",
        errorMessage: result.success ? undefined : (result.stderr ?? "Unknown error"),
        executionTimeMs: result.executionTimeMs,
      }).catch(() => {});

      return reply.send(result);
    },
  );
}
