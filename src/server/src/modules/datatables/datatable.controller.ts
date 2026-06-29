import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../../common/auth/middleware.js";
import { executeMqlQuery } from "./utils/query.js";
import { MqlParseError } from "./utils/parser.js";
import { createProjectBodySchema, updateProjectBodySchema, createTableBodySchema, updateTableBodySchema, addColumnBodySchema, updateColumnBodySchema, bulkDeleteRowsBodySchema, bulkUpdateRowsBodySchema, createRowBodySchema, updateRowBodySchema, listRowsQuerySchema, type CreateProjectBody, type UpdateProjectBody, type CreateTableBody, type UpdateTableBody, type AddColumnBody, type UpdateColumnBody, type CreateRowBody, type UpdateRowBody, type ListRowsQuery, type BulkDeleteRowsBody, type BulkUpdateRowsBody } from "./common/schema.js";
import { listProjects, getProjectById, createProject, updateProject, deleteProject } from "./project.service.js";
import { listTables, getTableById, createTable, updateTable, deleteTable, addColumn, updateColumn, deleteColumn, listRows, getRowById, createRow, updateRow, deleteRow, bulkDeleteRows, bulkUpdateRows } from "./table.service.js";


export function registerDatatableRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── Project CRUD ────────────────────────────────────────────────────────────

  // GET / — list all projects
  r.get("/", { preHandler: [requireAuth] }, async (_req, reply) => {
    const items = await listProjects();
    return reply.send({
      items,
      meta: { total: items.length },
    });
  });

  // POST / — create project
  r.post(
    "/",
    {
      preHandler: [requireAuth],
      schema: { body: createProjectBodySchema },
    },
    async (req, reply) => {
      const result = await createProject(req.body as CreateProjectBody, req.auth!.userId);
      return reply.code(201).send(result);
    },
  );

  // GET /:id — get project by id
  r.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await getProjectById(id);
    if (!result) return reply.code(400).send({ error: "not_found", message: "Project not found" });
    return reply.send(result);
  });

  // PATCH /:id — update project metadata
  r.patch(
    "/:id",
    {
      preHandler: [requireAuth],
      schema: { body: updateProjectBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await getProjectById(id);
      if (!existing) return reply.code(400).send({ error: "not_found", message: "Project not found" });

      const result = await updateProject(id, req.body as UpdateProjectBody);
      return reply.send(result);
    },
  );

  // DELETE /:id — delete project (cascades tables + rows)
  r.delete("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await getProjectById(id);
    if (!existing) return reply.code(400).send({ error: "not_found", message: "Project not found" });

    await deleteProject(id);
    return reply.send({ id, deleted: true });
  });

  // ── Table CRUD ──────────────────────────────────────────────────────────────

  // GET /:projectId/tables — list tables in project
  r.get("/:projectId/tables", { preHandler: [requireAuth] }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await getProjectById(projectId);
    if (!project) return reply.code(400).send({ error: "not_found", message: "Project not found" });

    const tables = await listTables(projectId);
    return reply.send({
      items: tables,
      meta: { total: tables.length },
    });
  });

  // POST /:projectId/tables — create table in project
  r.post(
    "/:projectId/tables",
    {
      preHandler: [requireAuth],
      schema: { body: createTableBodySchema },
    },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const project = await getProjectById(projectId);
      if (!project) return reply.code(400).send({ error: "not_found", message: "Project not found" });

      const table = await createTable(projectId, req.body as CreateTableBody, req.auth!.userId);
      return reply.code(201).send(table);
    },
  );

  // GET /:projectId/tables/:id — get table by id
  r.get("/:projectId/tables/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { projectId: string; id: string };
    const table = await getTableById(id);
    if (!table) return reply.code(400).send({ error: "not_found", message: "Table not found" });
    return reply.send(table);
  });

  // PATCH /:projectId/tables/:id — update table metadata
  r.patch(
    "/:projectId/tables/:id",
    {
      preHandler: [requireAuth],
      schema: { body: updateTableBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const existing = await getTableById(id);
      if (!existing) return reply.code(400).send({ error: "not_found", message: "Table not found" });

      const table = await updateTable(id, req.body as UpdateTableBody);
      return reply.send(table);
    },
  );

  // DELETE /:projectId/tables/:id — delete table + cascade rows
  r.delete("/:projectId/tables/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { projectId: string; id: string };
    const existing = await getTableById(id);
    if (!existing) return reply.code(400).send({ error: "not_found", message: "Table not found" });

    await deleteTable(id);
    return reply.send({ id, deleted: true });
  });

  // ── Column Management ────────────────────────────────────────────────────────

  // GET /:projectId/tables/:id/columns — list columns
  r.get("/:projectId/tables/:id/columns", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { projectId: string; id: string };
    const table = await getTableById(id);
    if (!table) return reply.code(400).send({ error: "not_found", message: "Table not found" });
    return reply.send({
      items: table.columns,
      meta: { total: table.columns.length },
    });
  });

  // POST /:projectId/tables/:id/columns — add column
  r.post(
    "/:projectId/tables/:id/columns",
    {
      preHandler: [requireAuth],
      schema: { body: addColumnBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const col = await addColumn(id, req.body as AddColumnBody);
      if (!col) return reply.code(400).send({ error: "not_found", message: "Table not found" });
      return reply.code(201).send(col);
    },
  );

  // PATCH /:projectId/tables/:id/columns/:colId — update column
  r.patch(
    "/:projectId/tables/:id/columns/:colId",
    {
      preHandler: [requireAuth],
      schema: { body: updateColumnBodySchema },
    },
    async (req, reply) => {
      const { id, colId } = req.params as { projectId: string; id: string; colId: string };
      const col = await updateColumn(id, colId, req.body as UpdateColumnBody);
      if (!col) return reply.code(400).send({ error: "not_found", message: "Table or column not found" });
      return reply.send(col);
    },
  );

  // DELETE /:projectId/tables/:id/columns/:colId — delete column
  r.delete(
    "/:projectId/tables/:id/columns/:colId",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id, colId } = req.params as { projectId: string; id: string; colId: string };
      try {
        const result = await deleteColumn(id, colId);
        if (!result) return reply.code(400).send({ error: "not_found", message: "Table or column not found" });
        return reply.send({ colId, deleted: true });
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode === 400) {
          return reply.code(400).send({ error: "bad_request", message: (err as Error).message });
        }
        throw err;
      }
    },
  );

  // ── Row CRUD ──────────────────────────────────────────────────────────────────

  // GET /:projectId/tables/:id/rows — list rows (paginated)
  r.get(
    "/:projectId/tables/:id/rows",
    {
      preHandler: [requireAuth],
      schema: { querystring: listRowsQuerySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const table = await getTableById(id);
      if (!table) return reply.code(400).send({ error: "not_found", message: "Table not found" });

      const result = await listRows(id, req.query as ListRowsQuery);
      return reply.send(result);
    },
  );

  // GET /:projectId/tables/:id/rows/:rowId — get single row
  r.get("/:projectId/tables/:id/rows/:rowId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, rowId } = req.params as { projectId: string; id: string; rowId: string };
    const table = await getTableById(id);
    if (!table) return reply.code(400).send({ error: "not_found", message: "Table not found" });
    const row = await getRowById(id, rowId);
    if (!row) return reply.code(400).send({ error: "not_found", message: "Row not found" });
    return reply.send(row);
  });

  // POST /:projectId/tables/:id/rows — create row
  r.post(
    "/:projectId/tables/:id/rows",
    {
      preHandler: [requireAuth],
      schema: { body: createRowBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const table = await getTableById(id);
      if (!table) return reply.code(400).send({ error: "not_found", message: "Table not found" });

      const row = await createRow(id, req.body as CreateRowBody, req.auth!.userId);
      return reply.code(201).send(row);
    },
  );

  // PATCH /:projectId/tables/:id/rows/:rowId — update row
  r.patch(
    "/:projectId/tables/:id/rows/:rowId",
    {
      preHandler: [requireAuth],
      schema: { body: updateRowBodySchema },
    },
    async (req, reply) => {
      const { id, rowId } = req.params as { projectId: string; id: string; rowId: string };
      const row = await updateRow(id, rowId, req.body as UpdateRowBody);
      if (!row) return reply.code(400).send({ error: "not_found", message: "Row not found" });
      return reply.send(row);
    },
  );

  // DELETE /:projectId/tables/:id/rows/:rowId — delete row
  r.delete(
    "/:projectId/tables/:id/rows/:rowId",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { id, rowId } = req.params as { projectId: string; id: string; rowId: string };
      const result = await deleteRow(id, rowId);
      if (!result) return reply.code(400).send({ error: "not_found", message: "Row not found" });
      return reply.send({ rowId, deleted: true });
    },
  );

  // POST /:projectId/tables/:id/rows/bulk-delete — bulk delete rows
  r.post(
    "/:projectId/tables/:id/rows/bulk-delete",
    {
      preHandler: [requireAuth],
      schema: { body: bulkDeleteRowsBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const { rowIds } = req.body as BulkDeleteRowsBody;
      const result = await bulkDeleteRows(id, rowIds);
      return reply.send(result);
    },
  );

  // POST /:projectId/tables/:id/rows/bulk-update — bulk update rows
  r.post(
    "/:projectId/tables/:id/rows/bulk-update",
    {
      preHandler: [requireAuth],
      schema: { body: bulkUpdateRowsBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const { updates } = req.body as BulkUpdateRowsBody;
      const result = await bulkUpdateRows(id, updates);
      return reply.send(result);
    },
  );

  // ── MQL Query ─────────────────────────────────────────────────────────────────

  // POST /:projectId/tables/:id/query — execute MQL query
  r.post(
    "/:projectId/tables/:id/query",
    {
      preHandler: [requireAuth],
      schema: {
        body: z.object({
          q: z.string().min(1).max(2000),
        }),
      },
    },
    async (req, reply) => {
      const { id } = req.params as { projectId: string; id: string };
      const { q } = req.body as { q: string };

      try {
        const result = await executeMqlQuery(id, q);
        return reply.send(result);
      } catch (err) {
        if (err instanceof MqlParseError) {
          return reply.code(400).send({
            error: "mql_parse_error",
            message: err.message,
          });
        }
        if ((err as { statusCode?: number }).statusCode === 400) {
          return reply.code(400).send({
            error: "not_found",
            message: (err as Error).message,
          });
        }
        throw err;
      }
    },
  );
}
