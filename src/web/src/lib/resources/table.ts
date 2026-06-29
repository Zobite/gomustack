import type { HttpClient } from "../http";
import type {
  AddColumnInput,
  ColumnDef,
  CreateRowInput,
  CreateTableInput,
  DynamicTable,
  DynamicTableRow,
  RowListQuery,
  RowListResult,
  UpdateColumnInput,
  UpdateRowInput,
  UpdateTableInput,
} from "../types";

export class TablesResource {
  constructor(private http: HttpClient) {}

  private basePath(dbId: string) {
    return `/api/datatables/${dbId}/tables`;
  }

  // ── Table CRUD ──────────────────────────────────────────────────────────────

  /** List tables in a database */
  async list(projectId: string): Promise<DynamicTable[]> {
    const res = await this.http.get<{ items: DynamicTable[]; meta: { total: number } }>(this.basePath(projectId));
    return res.items;
  }

  /** Get table by ID */
  async get(projectId: string, id: string): Promise<DynamicTable> {
    return this.http.get<DynamicTable>(`${this.basePath(projectId)}/${id}`);
  }

  /** Create a new table in a database */
  async create(projectId: string, input: CreateTableInput): Promise<DynamicTable> {
    return this.http.post<DynamicTable>(this.basePath(projectId), input);
  }

  /** Update table metadata */
  async update(projectId: string, id: string, input: UpdateTableInput): Promise<DynamicTable> {
    return this.http.patch<DynamicTable>(`${this.basePath(projectId)}/${id}`, input);
  }

  /** Delete table and all its rows */
  async delete(projectId: string, id: string): Promise<void> {
    await this.http.delete(`${this.basePath(projectId)}/${id}`);
  }

  // ── Column Management ────────────────────────────────────────────────────────

  /** List columns of a table */
  async listColumns(projectId: string, tableId: string): Promise<ColumnDef[]> {
    const res = await this.http.get<{ items: ColumnDef[]; meta: { total: number } }>(`${this.basePath(projectId)}/${tableId}/columns`);
    return res.items;
  }

  /** Add a column to a table */
  async addColumn(projectId: string, tableId: string, input: AddColumnInput): Promise<ColumnDef> {
    return this.http.post<ColumnDef>(`${this.basePath(projectId)}/${tableId}/columns`, input);
  }

  /** Update a column */
  async updateColumn(projectId: string, tableId: string, colId: string, input: UpdateColumnInput): Promise<ColumnDef> {
    return this.http.patch<ColumnDef>(`${this.basePath(projectId)}/${tableId}/columns/${colId}`, input);
  }

  /** Delete a column */
  async deleteColumn(projectId: string, tableId: string, colId: string): Promise<void> {
    await this.http.delete(`${this.basePath(projectId)}/${tableId}/columns/${colId}`);
  }

  // ── Row CRUD ──────────────────────────────────────────────────────────────────

  /** List rows of a table (paginated, with optional filter/sort) */
  async listRows(projectId: string, tableId: string, query?: RowListQuery): Promise<RowListResult> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.sort) params.set("sort", query.sort);
    if (query?.order) params.set("order", query.order);
    if (query?.filter && query.filter.length > 0) {
      params.set("filter", JSON.stringify(query.filter));
    }
    if (query?.filterLogic) params.set("filterLogic", query.filterLogic);
    const qs = params.toString();
    return this.http.get<RowListResult>(`${this.basePath(projectId)}/${tableId}/rows${qs ? `?${qs}` : ""}`);
  }

  /** Get a single row */
  async getRow(projectId: string, tableId: string, rowId: string): Promise<DynamicTableRow> {
    return this.http.get<DynamicTableRow>(`${this.basePath(projectId)}/${tableId}/rows/${rowId}`);
  }

  /** Create a new row */
  async createRow(projectId: string, tableId: string, input?: CreateRowInput): Promise<DynamicTableRow> {
    return this.http.post<DynamicTableRow>(`${this.basePath(projectId)}/${tableId}/rows`, input ?? {});
  }

  /** Update a row (merges data) */
  async updateRow(projectId: string, tableId: string, rowId: string, input: UpdateRowInput): Promise<DynamicTableRow> {
    return this.http.patch<DynamicTableRow>(`${this.basePath(projectId)}/${tableId}/rows/${rowId}`, input);
  }

  /** Delete a row */
  async deleteRow(projectId: string, tableId: string, rowId: string): Promise<void> {
    await this.http.delete(`${this.basePath(projectId)}/${tableId}/rows/${rowId}`);
  }

  /** Bulk delete rows */
  async bulkDeleteRows(projectId: string, tableId: string, rowIds: string[]): Promise<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(`${this.basePath(projectId)}/${tableId}/rows/bulk-delete`, { rowIds });
  }

  /** Bulk update rows */
  async bulkUpdateRows(
    projectId: string,
    tableId: string,
    updates: { rowId: string; data: Record<string, unknown> }[],
  ): Promise<{ updated: number; items: unknown[] }> {
    return this.http.post(`${this.basePath(projectId)}/${tableId}/rows/bulk-update`, { updates });
  }
}
