import type { HttpClient } from "../http";
import type { CreateVariableInput, UpdateVariableInput, Variable, VariableListQuery, VariableListResult } from "../types";

// ── KV Store Resource ──────────────────────────────────────────────────────────

export class KvStoreResource {
  constructor(private http: HttpClient) {}

  private basePath = "/api/kv-store";

  /** List variables with optional filters */
  async list(query?: VariableListQuery): Promise<VariableListResult> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.sort) params.set("sort", query.sort);
    if (query?.order) params.set("order", query.order);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return this.http.get<VariableListResult>(`${this.basePath}${qs ? `?${qs}` : ""}`);
  }

  /** Get variable by ID */
  async get(id: string): Promise<Variable> {
    return this.http.get<Variable>(`${this.basePath}/${id}`);
  }

  /** Get variable by key */
  async getByKey(key: string): Promise<Variable> {
    return this.http.get<Variable>(`${this.basePath}/by-key/${key}`);
  }

  /** Create or upsert a variable */
  async create(input: CreateVariableInput): Promise<Variable> {
    return this.http.post<Variable>(this.basePath, input);
  }

  /** Bulk create/upsert variables */
  async bulkCreate(variables: CreateVariableInput[]): Promise<Variable[]> {
    const res = await this.http.post<{ items: Variable[]; meta: { total: number } }>(`${this.basePath}/bulk`, { variables });
    return res.items;
  }

  /** Update a variable */
  async update(id: string, input: UpdateVariableInput): Promise<Variable> {
    return this.http.patch<Variable>(`${this.basePath}/${id}`, input);
  }

  /** Delete a variable */
  async delete(id: string): Promise<void> {
    await this.http.delete(`${this.basePath}/${id}`);
  }

  /** Flush all variables */
  async flush(): Promise<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.basePath}/flush`);
  }
}
