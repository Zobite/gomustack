/**
 * MQL Query Service
 *
 * Processes parsed MQL queries against Dynamic Table rows.
 * Supports: select columns, nested filters (AND/OR), multi-sort,
 * IN, BETWEEN, LIKE, count-only mode, limit/offset.
 *
 * Security: Column names from MQL are validated against the table's
 * defined columns. Unknown columns are rejected.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../../common/db/client.js";
import { dynamicTables, dynamicTableRows } from "../../../common/db/schema.js";
import type { ColumnDef } from "../common/schema.js";
import {
  parseMql,
  MqlParseError,
  type MqlResult,
  type MqlFilterNode,
  type MqlCondition,
  type MqlSortRule,
} from "./parser.js";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseColumns(raw: string): ColumnDef[] {
  try { return JSON.parse(raw) as ColumnDef[]; } catch { return []; }
}

function parseData(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function formatRow(row: typeof dynamicTableRows.$inferSelect) {
  return { ...row, data: parseData(row.data) };
}

// ── Column Resolution ───────────────────────────────────────────────────────────

/** Built-in columns that don't require column lookup */
const BUILTIN_COLUMNS = new Set(["created_at", "updated_at"]);

/**
 * Resolve a column name to its internal ID.
 * Accepts: column ID (col_xxx), column name (case-insensitive), or built-in.
 * Throws if column not found in schema.
 */
function resolveColumnId(
  name: string,
  columns: ColumnDef[],
): { id: string; isBuiltin: boolean } {
  // Built-in meta columns
  if (BUILTIN_COLUMNS.has(name.toLowerCase())) {
    return { id: name.toLowerCase(), isBuiltin: true };
  }

  // Already a column ID?
  if (name.startsWith("col_")) {
    const found = columns.find((c) => c.id === name);
    if (found) return { id: found.id, isBuiltin: false };
    throw new MqlParseError(`Unknown column ID: ${name}`);
  }

  // Resolve by name (case-insensitive)
  const col = columns.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (col) return { id: col.id, isBuiltin: false };

  throw new MqlParseError(
    `Unknown column: '${name}'. Available columns: ${columns.map((c) => c.name).join(", ")}`,
  );
}

// ── Filter Evaluation ───────────────────────────────────────────────────────────

function evaluateCondition(
  rowData: Record<string, unknown>,
  row: ReturnType<typeof formatRow>,
  cond: MqlCondition,
  columns: ColumnDef[],
): boolean {
  const resolved = resolveColumnId(cond.column, columns);

  let cellValue: unknown;
  if (resolved.isBuiltin) {
    cellValue = resolved.id === "created_at" ? row.createdAt : row.updatedAt;
  } else {
    cellValue = rowData[resolved.id];
  }

  const filterValue = cond.value;

  switch (cond.op) {
    case "is_empty":
      return cellValue === null || cellValue === undefined || cellValue === "";
    case "is_not_empty":
      return cellValue !== null && cellValue !== undefined && cellValue !== "";
    case "eq":
      if (typeof cellValue === "boolean")
        return cellValue === (filterValue === true || filterValue === "true");
      return String(cellValue ?? "").toLowerCase() === String(filterValue ?? "").toLowerCase();
    case "neq":
      if (typeof cellValue === "boolean")
        return cellValue !== (filterValue === true || filterValue === "true");
      return String(cellValue ?? "").toLowerCase() !== String(filterValue ?? "").toLowerCase();
    case "contains":
      return String(cellValue ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase());
    case "not_contains":
      return !String(cellValue ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase());
    case "starts_with":
      return String(cellValue ?? "").toLowerCase().startsWith(String(filterValue ?? "").toLowerCase());
    case "ends_with":
      return String(cellValue ?? "").toLowerCase().endsWith(String(filterValue ?? "").toLowerCase());
    case "ilike":
      return String(cellValue ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase());
    case "gt":
      return Number(cellValue) > Number(filterValue);
    case "gte":
      return Number(cellValue) >= Number(filterValue);
    case "lt":
      return Number(cellValue) < Number(filterValue);
    case "lte":
      return Number(cellValue) <= Number(filterValue);
    case "in": {
      if (!Array.isArray(filterValue)) return false;
      const cell = String(cellValue ?? "").toLowerCase();
      return filterValue.some((v) => String(v).toLowerCase() === cell);
    }
    case "not_in": {
      if (!Array.isArray(filterValue)) return true;
      const cell = String(cellValue ?? "").toLowerCase();
      return !filterValue.some((v) => String(v).toLowerCase() === cell);
    }
    case "between": {
      if (!Array.isArray(filterValue) || filterValue.length !== 2) return false;
      const num = Number(cellValue);
      return num >= Number(filterValue[0]) && num <= Number(filterValue[1]);
    }
    default:
      return true;
  }
}

function evaluateFilterNode(
  rowData: Record<string, unknown>,
  row: ReturnType<typeof formatRow>,
  node: MqlFilterNode,
  columns: ColumnDef[],
): boolean {
  if ("and" in node) {
    return node.and.every((child) => evaluateFilterNode(rowData, row, child, columns));
  }
  if ("or" in node) {
    return node.or.some((child) => evaluateFilterNode(rowData, row, child, columns));
  }
  return evaluateCondition(rowData, row, node, columns);
}

// ── Sort ────────────────────────────────────────────────────────────────────────

function buildSortComparator(
  sortRules: MqlSortRule[],
  columns: ColumnDef[],
) {
  // Pre-resolve column IDs
  const resolved = sortRules.map((r) => ({
    ...resolveColumnId(r.column, columns),
    direction: r.direction,
  }));

  return (a: ReturnType<typeof formatRow>, b: ReturnType<typeof formatRow>): number => {
    for (const rule of resolved) {
      let aVal: unknown;
      let bVal: unknown;

      if (rule.isBuiltin) {
        aVal = rule.id === "created_at" ? a.createdAt : a.updatedAt;
        bVal = rule.id === "created_at" ? b.createdAt : b.updatedAt;
      } else {
        aVal = a.data[rule.id];
        bVal = b.data[rule.id];
      }

      // Nulls last
      if (aVal == null && bVal == null) continue;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" });
      }

      if (cmp !== 0) {
        return rule.direction === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  };
}

// ── Select Projection ───────────────────────────────────────────────────────────

function projectRow(
  row: ReturnType<typeof formatRow>,
  selectColumns: string[] | undefined,
  columns: ColumnDef[],
) {
  if (!selectColumns || selectColumns.length === 0) return row;

  // Resolve select column names → IDs
  const resolvedIds = selectColumns.map((name) => resolveColumnId(name, columns));

  const projected: Record<string, unknown> = {};
  for (const r of resolvedIds) {
    if (r.isBuiltin) {
      // Include built-in as top-level
      projected[r.id] = r.id === "created_at" ? row.createdAt : row.updatedAt;
    } else {
      // Find column name for the response key
      const colDef = columns.find((c) => c.id === r.id);
      const key = colDef ? colDef.id : r.id;
      projected[key] = row.data[r.id];
    }
  }

  return {
    id: row.id,
    tableId: row.tableId,
    data: projected,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Column validation pass ──────────────────────────────────────────────────────

/** Validate all column references in the MQL result against the table schema */
function validateColumns(mql: MqlResult, columns: ColumnDef[]): void {
  // Validate SELECT columns
  if (mql.select && mql.select.length > 0) {
    for (const col of mql.select) {
      resolveColumnId(col, columns); // throws if not found
    }
  }

  // Validate ORDER BY columns
  if (mql.sort) {
    for (const rule of mql.sort) {
      resolveColumnId(rule.column, columns);
    }
  }

  // Validate filter columns (recursive)
  if (mql.filters) {
    validateFilterColumns(mql.filters, columns);
  }
}

function validateFilterColumns(node: MqlFilterNode, columns: ColumnDef[]): void {
  if ("and" in node) {
    for (const child of node.and) validateFilterColumns(child, columns);
    return;
  }
  if ("or" in node) {
    for (const child of node.or) validateFilterColumns(child, columns);
    return;
  }
  resolveColumnId(node.column, columns); // throws if not found
}

// ── Main Query Function ─────────────────────────────────────────────────────────

export interface MqlQueryResult {
  items: unknown[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    query: string; // echo back the MQL for debugging
  };
}

/**
 * Execute an MQL query against a table's rows.
 *
 * @param tableId - The table ID (from URL path)
 * @param query - Raw MQL string
 * @returns Query result with items and meta
 */
export async function executeMqlQuery(
  tableId: string,
  query: string,
): Promise<MqlQueryResult> {
  const db = getDb();

  // 1. Parse MQL
  const mql = parseMql(query);

  // 2. Load table to get column definitions
  const table = await db
    .select()
    .from(dynamicTables)
    .where(eq(dynamicTables.id, tableId))
    .get();
  if (!table) throw Object.assign(new Error("Table not found"), { statusCode: 400 });

  const columns = parseColumns(table.columns);

  // 3. Validate all column references against schema (security check)
  validateColumns(mql, columns);

  // 4. Load all rows (we process in-memory since data is JSON)
  const allDbRows = await db
    .select()
    .from(dynamicTableRows)
    .where(eq(dynamicTableRows.tableId, tableId))
    .all();

  let rows = allDbRows.map(formatRow);

  // 5. Apply filters
  if (mql.filters) {
    rows = rows.filter((row) =>
      evaluateFilterNode(row.data, row, mql.filters!, columns),
    );
  }

  const total = rows.length;

  // 6. Count-only mode
  if (mql.count) {
    return {
      items: [],
      meta: { total, limit: 0, offset: 0, hasMore: false, query },
    };
  }

  // 7. Apply sort
  if (mql.sort && mql.sort.length > 0) {
    rows.sort(buildSortComparator(mql.sort, columns));
  } else {
    // Default sort: most recently updated first
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // 8. Apply limit & offset
  const limit = mql.limit ?? 50;
  const offset = mql.offset ?? 0;
  const paged = rows.slice(offset, offset + limit);

  // 9. Apply column projection
  const projected = paged.map((row) => projectRow(row, mql.select, columns));

  return {
    items: projected,
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      query,
    },
  };
}
