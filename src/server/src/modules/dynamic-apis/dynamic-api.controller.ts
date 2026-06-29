import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../../common/auth/middleware.js";
import {
  createDynamicApiBodySchema,
  updateDynamicApiBodySchema,
  listDynamicApiQuerySchema,
  listDynamicApiLogsQuerySchema,
  dryRunBodySchema,
} from "./common/schema.js";
import type {
  CreateDynamicApiBody,
  UpdateDynamicApiBody,
  ListDynamicApiQuery,
  ListDynamicApiLogsQuery,
  DryRunBody,
} from "./common/schema.js";
import {
  listDynamicApis,
  getDynamicApiById,
  createDynamicApi,
  updateDynamicApi,
  deleteDynamicApi,
  listDynamicApiLogs,
} from "./dynamic-api.service.js";
import { executeIsolated, hasNpmImports } from "../../common/sandbox/js-executor.js";
import { runCodingAgent, type AgentEvent } from "./utils/coding.js";


export function registerDynamicApiRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET / — list all dynamic APIs
  r.get(
    "/",
    {
      preHandler: [requireAuth],
      schema: { querystring: listDynamicApiQuerySchema },
    },
    async (req, reply) => {
      const result = await listDynamicApis(req.query as ListDynamicApiQuery);
      return reply.send(result);
    }
  );

  // POST / — create dynamic API
  r.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: { body: createDynamicApiBodySchema },
    },
    async (req, reply) => {
      const result = await createDynamicApi(
        req.body as CreateDynamicApiBody,
        req.auth!.userId
      );
      return reply.code(201).send(result);
    }
  );

  // GET /:id — get dynamic API by ID
  r.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await getDynamicApiById(id);
    if (!result)
      return reply
        .code(400)
        .send({ error: "not_found", message: "API endpoint not found" });
    return reply.send(result);
  });

  // PATCH /:id — update dynamic API
  r.patch(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: { body: updateDynamicApiBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await getDynamicApiById(id);
      if (!existing)
        return reply
          .code(400)
          .send({ error: "not_found", message: "API endpoint not found" });

      const result = await updateDynamicApi(
        id,
        req.body as UpdateDynamicApiBody
      );
      return reply.send(result);
    }
  );

  // DELETE /:id — delete dynamic API
  r.delete("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await getDynamicApiById(id);
    if (!existing)
      return reply
        .code(400)
        .send({ error: "not_found", message: "API endpoint not found" });

    await deleteDynamicApi(id);
    return reply.send({ id, deleted: true });
  });

  // GET /:id/logs — list logs for a dynamic API
  r.get(
    "/:id/logs",
    {
      preHandler: [requireAuth],
      schema: { querystring: listDynamicApiLogsQuerySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await getDynamicApiById(id);
      if (!existing)
        return reply
          .code(400)
          .send({ error: "not_found", message: "API endpoint not found" });

      const result = await listDynamicApiLogs(
        id,
        req.query as ListDynamicApiLogsQuery
      );
      return reply.send(result);
    }
  );

  // POST /:id/test — dry-run: execute code from DB (draft or prod)
  r.post(
    "/:id/test",
    {
      preHandler: [requireAuth],
      schema: { body: dryRunBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await getDynamicApiById(id);
      if (!existing)
        return reply
          .code(400)
          .send({ error: "not_found", message: "API endpoint not found" });

      const input = req.body as DryRunBody;

      // Use code from body if provided, otherwise pick from DB based on source
      const codeToTest = input.code
        ? input.code
        : input.source === "prod"
          ? existing.code
          : (existing.draftCode ?? existing.code);

      const startTime = Date.now();

      const requestObj = {
        method: input.method ?? existing.method,
        path: input.path ?? existing.path,
        params: input.params ?? {},
        query: input.query ?? {},
        headers: input.headers ?? {},
        body: input.body ?? null,
      };

      const needsIsolation = hasNpmImports(codeToTest);

      if (needsIsolation) {
        // Isolated mode: run in subprocess
        const result = await executeIsolated({
          apiId: id,
          code: codeToTest,
          request: requestObj,
          timeoutMs: input.timeout ?? 30000,
        });

        return reply.send({
          status: result.status,
          headers: result.headers,
          body: result.body,
          consoleLogs: result.consoleLogs,
          executionTimeMs: result.executionTimeMs,
          executionMode: "isolated",
          error: result.error,
        });
      }

      // Fast mode: compile and run in-process
      const consoleLogs: string[] = [];
      const context = {
        log: (...args: unknown[]) => {
          consoleLogs.push(
            args
              .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
              .join(" ")
          );
        },
      };

      try {
        const cleanCode = codeToTest
          .replace(/export\s+default\s+/g, "")
          .replace(/module\.exports\s*=\s*/g, "");

        const AsyncFunction = Object.getPrototypeOf(
          async function () {}
        ).constructor;

        const factory = new AsyncFunction(
          `${cleanCode}
          if (typeof handler === 'function') return handler;
          throw new Error('No handler function found.');`
        );

        const handler = await factory();

        const result = await Promise.race([
          handler(requestObj, context),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Execution timeout")),
              input.timeout ?? 30000
            )
          ),
        ]);

        const executionTimeMs = Date.now() - startTime;

        if (result && typeof result === "object") {
          return reply.send({
            status: (result as Record<string, unknown>).status ?? 200,
            headers: (result as Record<string, unknown>).headers,
            body: (result as Record<string, unknown>).body ?? null,
            consoleLogs,
            executionTimeMs,
            executionMode: "fast",
          });
        }

        return reply.send({
          status: 200,
          body: result,
          consoleLogs,
          executionTimeMs,
          executionMode: "fast",
        });
      } catch (err: unknown) {
        const error = err as Error;
        return reply.send({
          status: 500,
          body: {
            error: "execution_error",
            message: error.message,
          },
          consoleLogs,
          executionTimeMs: Date.now() - startTime,
          error: error.stack || error.message,
        });
      }
    }
  );

  // ── Coding Agent SSE Endpoint ────────────────────────────────────────────

  const codingAgentBodySchema = z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    prompt: z.string().min(1),
    currentCode: z.string().default(""),
    apiId: z.string().min(1),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    path: z.string().default("/"),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).default([]),
  });

  // POST /coding-agent — SSE stream of coding agent events
  r.post(
    "/coding-agent",
    {
      preHandler: [requireAuth],
      schema: { body: codingAgentBodySchema },
    },
    async (req, reply) => {
      const input = req.body as z.infer<typeof codingAgentBodySchema>;

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: AgentEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        await runCodingAgent(input, sendEvent);
        reply.raw.write(`data: ${JSON.stringify({ type: "stream_end" })}\n\n`);
      } catch (err: unknown) {
        console.error("[CodingAgent] Error:", err);
        const message = err instanceof Error ? err.message : "Agent failed";
        reply.raw.write(
          `data: ${JSON.stringify({ type: "error", message })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }
    },
  );
}
