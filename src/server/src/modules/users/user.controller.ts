import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, requireAdmin } from "../../common/auth/middleware.js";
import { createUserBodySchema, updateUserBodySchema, adminResetPasswordBodySchema } from "./common/schema.js";
import type { CreateUserBody, UpdateUserBody, AdminResetPasswordBody } from "./common/schema.js";
import { listUsers, getUserById, createUser, updateUser, deleteUser, adminResetPassword } from "./user.service.js";

export function registerUsersRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /
  r.get("/", { preHandler: [requireAdmin] }, async (_req, reply) => {
    const users = await listUsers();
    return reply.send({
      items: users,
      meta: { total: users.length },
    });
  });

  // GET /:id
  r.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };

    // Non-admins can only view themselves
    if (req.auth!.role === "member" && req.auth!.userId !== id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const user = await getUserById(id);
    if (!user) return reply.code(400).send({ error: "not_found" });
    return reply.send(user);
  });

  // POST /
  r.post(
    "/",
    {
      preHandler: [requireAdmin],
      schema: { body: createUserBodySchema },
    },
    async (req, reply) => {
      const user = await createUser(req.body as CreateUserBody);
      return reply.code(201).send(user);
    },
  );

  // PATCH /:id
  r.patch(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: { body: updateUserBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as UpdateUserBody;

      // Only admin can change role
      if (body.role && req.auth!.role === "member") {
        return reply.code(403).send({ error: "forbidden", message: "Cannot change role" });
      }

      // Members can only edit themselves
      if (req.auth!.role === "member" && req.auth!.userId !== id) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const user = await updateUser(id, body);
      return reply.send(user);
    },
  );

  // DELETE /:id
  r.delete("/:id", { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await deleteUser(id);
      return reply.send({ id, deleted: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(400).send({ error: "bad_request", message });
    }
  });

  // POST /:id/reset-password — admin resets any user's password
  r.post(
    "/:id/reset-password",
    {
      preHandler: [requireAdmin],
      schema: { body: adminResetPasswordBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { password } = req.body as AdminResetPasswordBody;
      const result = await adminResetPassword(id, password);
      if (!result.ok) {
        return reply.code(400).send({ error: "not_found", message: "User not found" });
      }
      return reply.send({ success: true });
    },
  );
}
