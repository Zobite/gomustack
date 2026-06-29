import {
  matchRoute,
  pathMatchesAnyMethod,
  getWarmInstance,
  setWarmInstance,
  createDynamicApiLog,
} from "../dynamic-api.service.js";
import { resolveAuth } from "../../../common/auth/middleware.js";
import { executeIsolated, hasNpmImports } from "../../../common/sandbox/js-executor.js";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Register the catch-all dynamic API router.
 * All requests to /apis/* are handled here.
 *
 * Execution mode is auto-detected:
 * - Code has npm imports → isolated (Bun subprocess with auto-installed deps)
 * - Code has no npm imports → fast (in-process AsyncFunction)
 */
export function registerDynamicApiRunner(app: FastifyInstance) {
  app.all("/apis/*", async (req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    // Strip /apis prefix to get the dynamic path
    const rawPath = req.url.split("?")[0];
    const dynamicPath = rawPath.replace(/^\/apis/, "") || "/";

    const method = req.method;

    // Try to match route
    const matched = await matchRoute(method, dynamicPath);

    if (!matched) {
      const pathExists = await pathMatchesAnyMethod(dynamicPath);
      if (pathExists) {
        return reply.code(405).send({
          error: "method_not_allowed",
          message: `Method ${method} not allowed for ${dynamicPath}`,
        });
      }
      return reply.code(404).send({
        error: "not_found",
        message: "Endpoint not found",
      });
    }

    const { route, params } = matched;

    // Auth check (if not public)
    if (!route.isPublic) {
      const auth = await resolveAuth(req);
      if (!auth) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Authentication required",
        });
      }
    }

    // Build request object for handler
    const requestObj = {
      method,
      path: dynamicPath,
      params,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      body: req.body ?? null,
    };

    // Auto-detect execution mode from code imports
    const needsIsolation = hasNpmImports(route.code);
    const executionMode: "fast" | "isolated" = needsIsolation ? "isolated" : "fast";

    let statusCode = 200;
    let responseBody: unknown = null;
    let errorMsg: string | undefined;
    const consoleLogs: string[] = [];

    try {
      if (executionMode === "isolated") {
        // ── Isolated mode: auto-detect imports, install deps, run subprocess ─
        const result = await executeIsolated({
          apiId: route.id,
          code: route.code,
          explicitDeps: route.dependencies as Record<string, string> | null,
          request: requestObj,
          timeoutMs: route.timeout,
        });

        statusCode = result.status;
        responseBody = result.body;
        errorMsg = result.error;
        consoleLogs.push(...result.consoleLogs);

        if (result.headers && typeof result.headers === "object") {
          for (const [key, value] of Object.entries(result.headers)) {
            reply.header(key, value);
          }
        }
      } else {
        // ── Fast mode: compile and run in-process ───────────────────────────
        const context = {
          log: (...args: unknown[]) => {
            consoleLogs.push(
              args
                .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
                .join(" ")
            );
          },
        };

        let handler = getWarmInstance(route.id, route.code);

        if (!handler) {
          handler = await compileHandler(route.code);
          setWarmInstance(route.id, route.code, handler);
        }

        // Execute with timeout
        const result = await Promise.race([
          (handler as Function)(requestObj, context),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Execution timeout")),
              route.timeout
            )
          ),
        ]);

        if (result && typeof result === "object") {
          statusCode =
            ((result as Record<string, unknown>).status as number) ?? 200;
          const headers = (result as Record<string, unknown>).headers as
            | Record<string, string>
            | undefined;
          responseBody = (result as Record<string, unknown>).body ?? null;

          if (headers && typeof headers === "object") {
            for (const [key, value] of Object.entries(headers)) {
              reply.header(key, value);
            }
          }
        } else {
          responseBody = result;
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === "Execution timeout") {
        statusCode = 504;
        responseBody = { error: "timeout", message: "Execution timeout" };
        errorMsg = "Execution timeout";
      } else {
        statusCode = 500;
        responseBody = {
          error: "execution_error",
          message:
            process.env.NODE_ENV === "production"
              ? "Internal handler error"
              : error.message,
        };
        errorMsg = error.stack || error.message;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // Log execution (fire-and-forget)
    createDynamicApiLog({
      apiId: route.id,
      method,
      path: dynamicPath,
      statusCode,
      executionTimeMs,
      executionMode,
      requestHeaders: JSON.stringify(
        Object.fromEntries(
          Object.entries(req.headers).filter(
            ([k]) => !k.startsWith("authorization")
          )
        )
      ),
      requestBody: req.body
        ? JSON.stringify(req.body).slice(0, 10000)
        : undefined,
      responseBody: responseBody
        ? JSON.stringify(responseBody).slice(0, 10000)
        : undefined,
      consoleOutput:
        consoleLogs.length > 0 ? consoleLogs.join("\n") : undefined,
      error: errorMsg,
      ip: req.ip,
    }).catch(() => {});

    return reply.code(statusCode).send(responseBody);
  });
}

/**
 * Compile user code into a callable handler function.
 * Uses AsyncFunction constructor for fast-mode execution.
 */
async function compileHandler(code: string): Promise<Function> {
  try {
    const cleanCode = code
      .replace(/export\s+default\s+/g, "")
      .replace(/module\.exports\s*=\s*/g, "");

    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    const factory = new AsyncFunction(
      `
      ${cleanCode}
      if (typeof handler === 'function') return handler;
      throw new Error('No handler function found. Define: async function handler(request, context) { ... }');
      `
    );

    const handler = await factory();
    if (typeof handler !== "function") {
      throw new Error(
        "No handler function found. Define: async function handler(request, context) { ... }"
      );
    }

    return handler;
  } catch (err: unknown) {
    const error = err as Error;
    throw new Error(`Failed to compile handler: ${error.message}`);
  }
}
