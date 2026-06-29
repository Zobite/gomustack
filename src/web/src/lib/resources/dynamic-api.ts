import type { HttpClient } from "../http";
import type {
  CreateDynamicApiInput,
  DynamicApiItem,
  DynamicApiListQuery,
  DynamicApiListResult,
  DynamicApiLogListResult,
  UpdateDynamicApiInput,
} from "../types";

export class DynamicApisResource {
  constructor(private http: HttpClient) {}

  /** List all dynamic APIs */
  async list(query?: DynamicApiListQuery): Promise<DynamicApiListResult> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.method) params.set("method", query.method);
    if (query?.status) params.set("status", query.status);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return this.http.get<DynamicApiListResult>(`/api/dynamic-apis${qs ? `?${qs}` : ""}`);
  }

  /** Get dynamic API by ID */
  async get(id: string): Promise<DynamicApiItem> {
    return this.http.get<DynamicApiItem>(`/api/dynamic-apis/${id}`);
  }

  /** Create a new dynamic API */
  async create(input: CreateDynamicApiInput): Promise<DynamicApiItem> {
    return this.http.post<DynamicApiItem>("/api/dynamic-apis", input);
  }

  /** Update dynamic API */
  async update(id: string, input: UpdateDynamicApiInput): Promise<DynamicApiItem> {
    return this.http.patch<DynamicApiItem>(`/api/dynamic-apis/${id}`, input);
  }

  /** Delete dynamic API */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/dynamic-apis/${id}`);
  }

  /** List logs for a dynamic API */
  async listLogs(
    apiId: string,
    query?: {
      status?: "success" | "error";
      startDate?: number;
      endDate?: number;
      page?: number;
      limit?: number;
    },
  ): Promise<DynamicApiLogListResult> {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.startDate) params.set("startDate", String(query.startDate));
    if (query?.endDate) params.set("endDate", String(query.endDate));
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return this.http.get<DynamicApiLogListResult>(`/api/dynamic-apis/${apiId}/logs${qs ? `?${qs}` : ""}`);
  }
}
