import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { datatableProjects, dynamicTables, dynamicTableRows } from "../../common/db/schema.js";
import { genId, now } from "../../common/utils.js";
import type { CreateProjectBody, UpdateProjectBody } from "./common/schema.js";

// ── List all projects ──────────────────────────────────────────────────────────

export async function listProjects() {
  const db = getDb();
  const rows = await db
    .select()
    .from(datatableProjects)
    .orderBy(desc(datatableProjects.updatedAt))
    .all();

  // Count tables per project
  const counts = await db
    .select({
      projectId: dynamicTables.projectId,
      count: sql<number>`COUNT(*)`,
    })
    .from(dynamicTables)
    .where(sql`${dynamicTables.projectId} IS NOT NULL`)
    .groupBy(dynamicTables.projectId)
    .all();

  const countMap = new Map(counts.map((c) => [c.projectId, c.count]));

  return rows.map((row) => ({
    ...row,
    tableCount: countMap.get(row.id) ?? 0,
  }));
}

// ── Get project by ID ──────────────────────────────────────────────────────────

export async function getProjectById(id: string) {
  const db = getDb();
  const row = await db
    .select()
    .from(datatableProjects)
    .where(eq(datatableProjects.id, id))
    .get();
  if (!row) return null;

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(dynamicTables)
    .where(eq(dynamicTables.projectId, id))
    .get();

  return {
    ...row,
    tableCount: countResult?.count ?? 0,
  };
}

// ── Create project ─────────────────────────────────────────────────────────────

export async function createProject(data: CreateProjectBody, userId: string) {
  const db = getDb();
  const id = genId();
  const ts = now();

  await db.insert(datatableProjects).values({
    id,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    createdBy: userId,
    createdAt: ts,
    updatedAt: ts,
  });

  return getProjectById(id);
}

// ── Update project ─────────────────────────────────────────────────────────────

export async function updateProject(id: string, data: UpdateProjectBody) {
  const db = getDb();
  const ts = now();
  const updates: Record<string, unknown> = { updatedAt: ts };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.icon !== undefined) updates.icon = data.icon;

  await db.update(datatableProjects).set(updates).where(eq(datatableProjects.id, id));
  return getProjectById(id);
}

// ── Delete project ─────────────────────────────────────────────────────────────

export async function deleteProject(id: string) {
  const db = getDb();

  // Delete all rows belonging to tables in this project
  const tables = await db
    .select({ id: dynamicTables.id })
    .from(dynamicTables)
    .where(eq(dynamicTables.projectId, id))
    .all();

  for (const table of tables) {
    await db.delete(dynamicTableRows).where(eq(dynamicTableRows.tableId, table.id));
  }

  // Delete all tables in this project
  await db.delete(dynamicTables).where(eq(dynamicTables.projectId, id));

  // Delete the project itself
  await db.delete(datatableProjects).where(eq(datatableProjects.id, id));
  return true;
}
