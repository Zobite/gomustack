import type { HttpClient } from "../http";
import type { ApiKeyCreated, ApiKeyItem, CreateApiKeyInput } from "../types";

export class ApiKeysResource {
  constructor(private http: HttpClient) {}

  /** List all API keys for the current user */
  async list(): Promise<ApiKeyItem[]> {
    const res = await this.http.get<{ items: ApiKeyItem[]; meta: { total: number } }>("/api/api-keys");
    return res.items;
  }

  /** Create a new API key — returns raw key only once */
  async create(input: CreateApiKeyInput): Promise<ApiKeyCreated> {
    return this.http.post<ApiKeyCreated>("/api/api-keys", input);
  }

  /** Revoke (delete) an API key */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/api-keys/${id}`);
  }
}
