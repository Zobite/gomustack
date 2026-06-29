import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../common/db/client.js";
import { dynamicTableRows, dynamicTables } from "../../common/db/schema.js";
import { genId, now } from "../../common/utils.js";
import type {
  AddColumnBody,
  ColumnDef,
  CreateRowBody,
  CreateTableBody,
  FilterCondition,
  ListRowsQuery,
  UpdateColumnBody,
  UpdateRowBody,
  UpdateTableBody,
} from "./common/schema.js";
import { filterConditionSchema } from "./common/schema.js";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseColumns(raw: string): ColumnDef[] {
  try {
    return JSON.parse(raw) as ColumnDef[];
  } catch {
    return [];
  }
}

function parseData(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatTable(row: typeof dynamicTables.$inferSelect) {
  return {
    ...row,
    columns: parseColumns(row.columns),
  };
}

function formatRow(row: typeof dynamicTableRows.$inferSelect) {
  return {
    ...row,
    data: parseData(row.data),
  };
}

// ── Table CRUD ──────────────────────────────────────────────────────────────────

export async function listTables(projectId: string) {
  const db = getDb();

  const rows = await db.select().from(dynamicTables).where(eq(dynamicTables.projectId, projectId)).orderBy(desc(dynamicTables.updatedAt)).all();

  // Add row counts
  const tables = rows.map(formatTable);
  const counts = await db
    .select({
      tableId: dynamicTableRows.tableId,
      count: sql<number>`COUNT(*)`,
    })
    .from(dynamicTableRows)
    .groupBy(dynamicTableRows.tableId)
    .all();

  const countMap = new Map(counts.map((c) => [c.tableId, c.count]));

  return tables.map((t) => ({
    ...t,
    rowCount: countMap.get(t.id) ?? 0,
  }));
}

export async function getTableById(id: string) {
  const db = getDb();
  const row = await db.select().from(dynamicTables).where(eq(dynamicTables.id, id)).get();
  if (!row) return null;

  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(dynamicTableRows).where(eq(dynamicTableRows.tableId, id)).get();

  return {
    ...formatTable(row),
    rowCount: countResult?.count ?? 0,
  };
}

export async function createTable(projectId: string, data: CreateTableBody, userId: string) {
  const db = getDb();
  const id = genId();
  const ts = now();

  // Build columns from user input
  const columns: ColumnDef[] = data.columns.map((col, i) => ({
    id: genId(),
    name: col.name,
    type: col.type,
    order: i,
    required: i === 0, // first column is required by default
    options: col.options ?? {},
  }));

  await db.insert(dynamicTables).values({
    id,
    projectId,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    columns: JSON.stringify(columns),
    createdBy: userId,
    createdAt: ts,
    updatedAt: ts,
  });

  return getTableById(id);
}

export async function updateTable(id: string, data: UpdateTableBody) {
  const db = getDb();
  const ts = now();
  const updates: Record<string, unknown> = { updatedAt: ts };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.icon !== undefined) updates.icon = data.icon;

  await db.update(dynamicTables).set(updates).where(eq(dynamicTables.id, id));
  return getTableById(id);
}

export async function deleteTable(id: string) {
  const db = getDb();
  // Rows are cascade-deleted due to FK constraint
  await db.delete(dynamicTables).where(eq(dynamicTables.id, id));
  return true;
}

// ── Column Management ───────────────────────────────────────────────────────────

export async function addColumn(tableId: string, data: AddColumnBody) {
  const db = getDb();
  const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
  if (!table) return null;

  const columns = parseColumns(table.columns);
  const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;

  const newCol: ColumnDef = {
    id: genId(),
    name: data.name,
    type: data.type,
    order: maxOrder + 1,
    required: false,
    options: data.options ?? {},
  };

  columns.push(newCol);

  await db
    .update(dynamicTables)
    .set({ columns: JSON.stringify(columns), updatedAt: now() })
    .where(eq(dynamicTables.id, tableId));

  return newCol;
}

export async function updateColumn(tableId: string, colId: string, data: UpdateColumnBody) {
  const db = getDb();
  const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
  if (!table) return null;

  const columns = parseColumns(table.columns);
  const colIndex = columns.findIndex((c) => c.id === colId);
  if (colIndex === -1) return null;

  const col = columns[colIndex];
  if (data.name !== undefined) col.name = data.name;
  if (data.type !== undefined) col.type = data.type;
  if (data.options !== undefined) col.options = data.options ?? {};
  columns[colIndex] = col;

  await db
    .update(dynamicTables)
    .set({ columns: JSON.stringify(columns), updatedAt: now() })
    .where(eq(dynamicTables.id, tableId));

  return col;
}

export async function deleteColumn(tableId: string, colId: string) {
  const db = getDb();
  const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
  if (!table) return null;

  const columns = parseColumns(table.columns);
  const colIndex = columns.findIndex((c) => c.id === colId);
  if (colIndex === -1) return null;

  // Prevent deleting the primary (first) column
  if (colIndex === 0) {
    throw Object.assign(new Error("Cannot delete the primary column"), { statusCode: 400 });
  }

  columns.splice(colIndex, 1);

  await db
    .update(dynamicTables)
    .set({ columns: JSON.stringify(columns), updatedAt: now() })
    .where(eq(dynamicTables.id, tableId));

  // Remove the column data from all rows
  const rows = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.tableId, tableId)).all();

  for (const row of rows) {
    const rowData = parseData(row.data);
    delete rowData[colId];
    await db
      .update(dynamicTableRows)
      .set({ data: JSON.stringify(rowData) })
      .where(eq(dynamicTableRows.id, row.id));
  }

  return true;
}

export async function reorderColumns(tableId: string, columnIds: string[]) {
  const db = getDb();
  const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
  if (!table) return null;

  const columns = parseColumns(table.columns);
  const reordered: ColumnDef[] = [];

  for (let i = 0; i < columnIds.length; i++) {
    const col = columns.find((c) => c.id === columnIds[i]);
    if (col) {
      col.order = i;
      reordered.push(col);
    }
  }

  // Add any columns not in the reorder list at the end
  for (const col of columns) {
    if (!columnIds.includes(col.id)) {
      col.order = reordered.length;
      reordered.push(col);
    }
  }

  await db
    .update(dynamicTables)
    .set({ columns: JSON.stringify(reordered), updatedAt: now() })
    .where(eq(dynamicTables.id, tableId));

  return reordered;
}

// ── Filter helpers ──────────────────────────────────────────────────────────────

function parseFilters(filterStr?: string): FilterCondition[] {
  if (!filterStr) return [];
  try {
    const raw = JSON.parse(filterStr);
    if (!Array.isArray(raw)) return [];
    const conditions: FilterCondition[] = [];
    for (const item of raw) {
      const parsed = filterConditionSchema.safeParse(item);
      if (parsed.success) conditions.push(parsed.data);
    }
    return conditions;
  } catch {
    return [];
  }
}

/**
 * Resolve column names → column IDs for LLM-friendly filter API.
 * Accepts both `columnId` (ID) and `column` (name). `column` name is resolved
 * case-insensitively against the table's column definitions.
 */
function resolveFilters(filters: FilterCondition[], columns: ColumnDef[]): FilterCondition[] {
  return filters
    .map((f) => {
      // Already has columnId → use as-is
      if (f.columnId) return f;
      // Resolve column name → ID (case-insensitive)
      if (f.column) {
        const col = columns.find((c) => c.name.toLowerCase() === f.column!.toLowerCase());
        if (!col) return null; // unknown column name → skip
        return { ...f, columnId: col.id };
      }
      return null; // neither columnId nor column → skip
    })
    .filter((f): f is FilterCondition & { columnId: string } => f !== null);
}

function matchesCondition(rowData: Record<string, unknown>, condition: FilterCondition): boolean {
  if (!condition.columnId) return true; // skip if no columnId resolved
  const cellValue = rowData[condition.columnId];
  const filterValue = condition.value;

  switch (condition.operator) {
    case "is_empty":
      return cellValue === null || cellValue === undefined || cellValue === "";
    case "is_not_empty":
      return cellValue !== null && cellValue !== undefined && cellValue !== "";
    case "eq":
      // handle boolean comparison
      if (typeof cellValue === "boolean") return cellValue === (filterValue === true || filterValue === "true");
      return String(cellValue ?? "").toLowerCase() === String(filterValue ?? "").toLowerCase();
    case "neq":
      if (typeof cellValue === "boolean") return cellValue !== (filterValue === true || filterValue === "true");
      return String(cellValue ?? "").toLowerCase() !== String(filterValue ?? "").toLowerCase();
    case "contains":
      return String(cellValue ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());
    case "not_contains":
      return !String(cellValue ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());
    case "starts_with":
      return String(cellValue ?? "")
        .toLowerCase()
        .startsWith(String(filterValue ?? "").toLowerCase());
    case "ends_with":
      return String(cellValue ?? "")
        .toLowerCase()
        .endsWith(String(filterValue ?? "").toLowerCase());
    case "gt":
      return Number(cellValue) > Number(filterValue);
    case "gte":
      return Number(cellValue) >= Number(filterValue);
    case "lt":
      return Number(cellValue) < Number(filterValue);
    case "lte":
      return Number(cellValue) <= Number(filterValue);
    default:
      return true;
  }
}

function matchesAllFilters(rowData: Record<string, unknown>, conditions: FilterCondition[], logic: "and" | "or"): boolean {
  if (conditions.length === 0) return true;
  if (logic === "or") {
    return conditions.some((c) => matchesCondition(rowData, c));
  }
  return conditions.every((c) => matchesCondition(rowData, c));
}

// ── Row data key resolution (column name → column ID) ──────────────────────────

/**
 * Resolve data keys that are column names to column IDs.
 * Accepts both column IDs (col_xxx) and column names (case-insensitive).
 * This allows MCP agents and API clients to use human-readable column names.
 */
async function resolveDataKeys(tableId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!data || Object.keys(data).length === 0) return data;

  // Check if any key is NOT a column ID (doesn't start with "col_")
  const needsResolution = Object.keys(data).some((key) => !key.startsWith("col_"));
  if (!needsResolution) return data;

  // Load table columns for name→ID resolution
  const db = getDb();
  const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
  if (!table) return data;

  const columns = parseColumns(table.columns);
  const nameToId = new Map<string, string>();
  for (const col of columns) {
    nameToId.set(col.name.toLowerCase(), col.id);
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("col_")) {
      // Already a column ID
      resolved[key] = value;
    } else {
      // Try to resolve column name → ID (case-insensitive)
      const colId = nameToId.get(key.toLowerCase());
      if (colId) {
        resolved[colId] = value;
      } else {
        // Keep original key if no match (may be intentional)
        resolved[key] = value;
      }
    }
  }

  return resolved;
}

// ── Row CRUD ────────────────────────────────────────────────────────────────────

export async function listRows(tableId: string, query: ListRowsQuery) {
  const db = getDb();
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;

  // Parse filter conditions from query param
  const rawFilters = parseFilters(query.filter);
  const filterLogic = query.filterLogic ?? "and";

  // Load table columns for name→ID resolution (needed for LLM-friendly API)
  let tableColumns: ColumnDef[] = [];
  if (rawFilters.length > 0 || (query.sort && !["created_at", "updated_at"].includes(query.sort))) {
    const table = await db.select().from(dynamicTables).where(eq(dynamicTables.id, tableId)).get();
    if (table) tableColumns = parseColumns(table.columns);
  }

  // Resolve column names → IDs (supports both columnId and column name)
  const filters = resolveFilters(rawFilters, tableColumns);

  // Determine sort — also resolve column names for LLM-friendly sort
  let sortByColumn: string | null = null;
  let sortDirection: "asc" | "desc" = query.order ?? "desc";

  if (query.sort && !["created_at", "updated_at"].includes(query.sort)) {
    // Sort by column data (col_xxx, col_xxx:asc, or "Column Name")
    const parts = query.sort.split(":");
    let colRef = parts[0];
    if (parts[1] === "asc" || parts[1] === "desc") {
      sortDirection = parts[1];
    }
    // If colRef is not a column ID (doesn't start with col_), try resolve by name
    if (!colRef.startsWith("col_")) {
      const col = tableColumns.find((c) => c.name.toLowerCase() === colRef.toLowerCase());
      if (col) colRef = col.id;
    }
    sortByColumn = colRef;
  }

  if (filters.length === 0 && !sortByColumn) {
    // Fast path — no filter, standard sort → direct SQL
    const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(dynamicTableRows).where(eq(dynamicTableRows.tableId, tableId)).get();
    const total = countResult?.count ?? 0;

    const orderFn = sortDirection === "asc" ? asc : desc;
    const orderCol = query.sort === "created_at" ? dynamicTableRows.createdAt : dynamicTableRows.updatedAt;

    const offset = (page - 1) * limit;
    const rows = await db
      .select()
      .from(dynamicTableRows)
      .where(eq(dynamicTableRows.tableId, tableId))
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      items: rows.map(formatRow),
      meta: { total, page, limit, hasMore: offset + limit < total },
    };
  }

  // Slow path — need to load all rows for in-memory filter/sort
  const allRows = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.tableId, tableId)).all();

  let formatted = allRows.map(formatRow);

  // Apply filters
  if (filters.length > 0) {
    formatted = formatted.filter((row) => matchesAllFilters(row.data, filters, filterLogic));
  }

  // Apply sort
  if (sortByColumn) {
    const colId = sortByColumn;
    formatted.sort((a, b) => {
      const aVal = a.data[colId];
      const bVal = b.data[colId];
      // Nulls last
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      // Number comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      // String comparison
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  } else {
    // Sort by built-in field
    formatted.sort((a, b) => {
      const aVal = query.sort === "created_at" ? a.createdAt : a.updatedAt;
      const bVal = query.sort === "created_at" ? b.createdAt : b.updatedAt;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  const total = formatted.length;
  const offset = (page - 1) * limit;
  const paged = formatted.slice(offset, offset + limit);

  return {
    items: paged,
    meta: { total, page, limit, hasMore: offset + limit < total },
  };
}

export async function getRowById(tableId: string, rowId: string) {
  const db = getDb();
  const row = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.id, rowId)).get();
  if (!row || row.tableId !== tableId) return null;
  return formatRow(row);
}

export async function createRow(tableId: string, data: CreateRowBody, userId: string) {
  const db = getDb();
  const id = genId();
  const ts = now();

  // Resolve column names → column IDs for LLM-friendly API
  const resolvedData = await resolveDataKeys(tableId, data.data ?? {});

  await db.insert(dynamicTableRows).values({
    id,
    tableId,
    data: JSON.stringify(resolvedData),
    createdBy: userId,
    createdAt: ts,
    updatedAt: ts,
  });

  return getRowById(tableId, id);
}

export async function updateRow(tableId: string, rowId: string, data: UpdateRowBody) {
  const db = getDb();
  const existing = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.id, rowId)).get();
  if (!existing || existing.tableId !== tableId) return null;

  // Resolve column names → column IDs for LLM-friendly API
  const resolvedNewData = await resolveDataKeys(tableId, data.data ?? {});

  // Merge data — only update provided fields
  const existingData = parseData(existing.data);
  const mergedData = { ...existingData, ...resolvedNewData };

  await db
    .update(dynamicTableRows)
    .set({
      data: JSON.stringify(mergedData),
      updatedAt: now(),
    })
    .where(eq(dynamicTableRows.id, rowId));

  return getRowById(tableId, rowId);
}

export async function deleteRow(tableId: string, rowId: string) {
  const db = getDb();
  const existing = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.id, rowId)).get();
  if (!existing || existing.tableId !== tableId) return false;

  await db.delete(dynamicTableRows).where(eq(dynamicTableRows.id, rowId));
  return true;
}

export async function bulkDeleteRows(tableId: string, rowIds: string[]) {
  const db = getDb();
  let deleted = 0;

  for (const rowId of rowIds) {
    const existing = await db.select().from(dynamicTableRows).where(eq(dynamicTableRows.id, rowId)).get();
    if (existing && existing.tableId === tableId) {
      await db.delete(dynamicTableRows).where(eq(dynamicTableRows.id, rowId));
      deleted++;
    }
  }

  return { deleted };
}

export async function bulkUpdateRows(tableId: string, updates: { rowId: string; data: Record<string, unknown> }[]) {
  const results: ReturnType<typeof formatRow>[] = [];

  for (const { rowId, data } of updates) {
    const updated = await updateRow(tableId, rowId, { data });
    if (updated) results.push(updated);
  }

  return { updated: results.length, items: results };
}
