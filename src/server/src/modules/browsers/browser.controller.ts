import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "../../common/auth/middleware.js";
import { createProfileBodySchema, listProfilesQuerySchema, runStepsBodySchema, updateProfileBodySchema } from "./common/schema.js";
import type { CreateProfileBody, ListProfilesQuery, RunStepsBody, UpdateProfileBody } from "./common/schema.js";
import {
  captureScreenshot,
  createBrowserProfile,
  deleteBrowserProfile,
  getActiveTabs,
  getBrowserProfileById,
  getScreenshotsDir,
  listBrowserProfiles,
  runBatchSteps,
  startBrowser,
  stopBrowser,
  updateBrowserProfile,
} from "./browser.service.js";

export function registerBrowserRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET / — List profiles with pagination & search
  r.get(
    "/",
    {
      preHandler: [requireAuth],
      schema: { querystring: listProfilesQuerySchema },
    },
    async (req, reply) => {
      const userId = req.auth!.userId;
      const query = req.query as ListProfilesQuery;
      const result = await listBrowserProfiles(query, userId);
      return reply.send(result);
    },
  );

  // GET /:id — Get profile details with tabs
  r.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const profile = await getBrowserProfileById(id);
    if (!profile) {
      return reply.code(400).send({ error: "not_found", message: "Browser profile not found" });
    }
    const tabs = profile.status === "running" ? await getActiveTabs(id) : [];
    return reply.send({ ...profile, tabs });
  });

  // GET /:id/tabs — Get running profile's active tabs
  r.get("/:id/tabs", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const tabs = await getActiveTabs(id);
      return reply.send(tabs);
    } catch (err: any) {
      return reply.code(400).send({ error: "bad_request", message: err.message });
    }
  });

  // POST / — Create profile
  r.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: { body: createProfileBodySchema },
    },
    async (req, reply) => {
      const userId = req.auth!.userId;
      const body = req.body as CreateProfileBody;
      const profile = await createBrowserProfile(body, userId);
      return reply.code(201).send(profile);
    },
  );

  // PATCH /:id — Update profile config
  r.patch(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: { body: updateProfileBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as UpdateProfileBody;
      try {
        const updated = await updateBrowserProfile(id, body);
        return reply.send(updated);
      } catch (err: any) {
        return reply.code(400).send({ error: "bad_request", message: err.message });
      }
    },
  );

  // DELETE /:id — Delete profile
  r.delete("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await deleteBrowserProfile(id);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: "bad_request", message: err.message });
    }
  });

  // POST /:id/start — Start browser
  r.post("/:id/start", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const activeInfo = await startBrowser(id);
      return reply.send({
        id,
        status: "running",
        cdpPort: activeInfo.cdpPort,
        wsEndpoint: activeInfo.wsEndpoint,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", message: err.message });
    }
  });

  // POST /:id/stop — Stop browser
  r.post("/:id/stop", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await stopBrowser(id);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", message: err.message });
    }
  });

  // GET /:id/screenshot — Get raw live browser view for a specific tab
  r.get("/:id/screenshot", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tabIndex } = req.query as { tabIndex?: string };
    try {
      const idx = tabIndex !== undefined ? Number(tabIndex) : undefined;
      const buffer = await captureScreenshot(id, idx);
      return reply.header("Content-Type", "image/png").send(buffer);
    } catch (err: any) {
      return reply.code(400).send({ error: "bad_request", message: err.message });
    }
  });

  // POST /:id/control — Execute a sequence of browser actions on a profile
  r.post(
    "/:id/control",
    {
      preHandler: [requireAuth],
      schema: { body: runStepsBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as RunStepsBody;
      try {
        // Build base URL from request headers (Caddy/reverse-proxy forwards these)
        const protocol = req.headers["x-forwarded-proto"] ?? "http";
        const host = req.headers.host ?? "localhost";
        const baseUrl = `${protocol}://${host}`;
        const result = await runBatchSteps({ ...body, profileId: id, baseUrl });
        return reply.send(result);
      } catch (err: any) {
        return reply.code(400).send({ error: "bad_request", message: err.message });
      }
    },
  );

  // GET /screenshots/:filename — Serve saved screenshot PNG files
  r.get("/screenshots/:filename", async (req, reply) => {
    const { filename } = req.params as { filename: string };

    // Sanitize filename to prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || !filename.endsWith(".png")) {
      return reply.code(400).send({ error: "bad_request", message: "Invalid filename" });
    }

    const filepath = join(getScreenshotsDir(), filename);
    if (!existsSync(filepath)) {
      return reply.code(404).send({ error: "not_found", message: "Screenshot not found or expired" });
    }

    const buf = readFileSync(filepath);
    return reply.header("Content-Type", "image/png").header("Cache-Control", "public, max-age=3600").send(buf);
  });
}
