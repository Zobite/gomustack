import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth } from "../../common/auth/middleware.js";
import { loginBodySchema, refreshBodySchema, changePasswordBodySchema, setupBodySchema } from "./common/schema.js";
import type { LoginBody, RefreshBody, ChangePasswordBody, SetupBody } from "./common/schema.js";
import { loginService, refreshService, changePasswordService, getMeService, getSetupStatusService, setupService } from "./auth.service.js";

export function registerAuthRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /login
  r.post(
    "/login",
    { schema: { body: loginBodySchema } },
    async (req, reply) => {
      const { login, password } = req.body as LoginBody;
      const result = await loginService(login, password);
      if (!result) {
        return reply.code(401).send({ error: "invalid_credentials", message: "Invalid email or password" });
      }
      return reply.send(result);
    },
  );

  // POST /refresh
  r.post(
    "/refresh",
    { schema: { body: refreshBodySchema } },
    async (req, reply) => {
      const { refresh_token } = req.body as RefreshBody;
      try {
        const result = await refreshService(refresh_token);
        if (!result) {
          return reply.code(401).send({ error: "invalid_token", message: "Invalid or expired refresh token" });
        }
        return reply.send(result);
      } catch {
        return reply.code(401).send({ error: "invalid_token", message: "Invalid or expired refresh token" });
      }
    },
  );

  // POST /change-password (authenticated user changes own password)
  r.post(
    "/change-password",
    { preHandler: [requireAuth], schema: { body: changePasswordBodySchema } },
    async (req, reply) => {
      const { old_password, new_password } = req.body as ChangePasswordBody;
      const result = await changePasswordService(req.auth!.userId, old_password, new_password);

      if (!result.ok) {
        if (result.reason === "wrong_password") {
          return reply.code(400).send({ error: "wrong_password", message: "Current password is incorrect" });
        }
        return reply.code(400).send({ error: "not_found", message: "User not found" });
      }

      return reply.send({ success: true });
    },
  );

  // GET /me
  r.get("/me", { preHandler: [requireAuth] }, async (req, reply) => {
    const user = await getMeService(req.auth!.userId);
    if (!user) return reply.code(400).send({ error: "not_found" });
    return reply.send(user);
  });

  // GET /setup-status — public, returns whether initial setup is needed
  r.get("/setup-status", async (_req, reply) => {
    const status = await getSetupStatusService();
    return reply.send(status);
  });

  // POST /setup — public, creates the first admin (only works when no users exist)
  r.post(
    "/setup",
    { schema: { body: setupBodySchema } },
    async (req, reply) => {
      const body = req.body as SetupBody;
      const result = await setupService(body);

      if (!result.ok) {
        return reply.code(400).send({ error: result.reason, message: result.message });
      }

      return reply.send(result.data);
    },
  );
}
