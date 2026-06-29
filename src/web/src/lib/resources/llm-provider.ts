import type { HttpClient } from "../http";
import type { CreateLlmProviderInput, LlmProviderItem, UpdateLlmProviderInput } from "../types";

export class LlmProvidersResource {
  constructor(private http: HttpClient) {}

  /** List all LLM providers */
  async list(): Promise<LlmProviderItem[]> {
    const res = await this.http.get<{ items: LlmProviderItem[]; meta: { total: number } }>("/api/llm-providers");
    return res.items;
  }

  /** Get a single LLM provider by ID */
  async get(id: string): Promise<LlmProviderItem> {
    return this.http.get<LlmProviderItem>(`/api/llm-providers/${id}`);
  }

  /** Create a new LLM provider */
  async create(input: CreateLlmProviderInput): Promise<LlmProviderItem> {
    return this.http.post<LlmProviderItem>("/api/llm-providers", input);
  }

  /** Update an LLM provider */
  async update(id: string, input: UpdateLlmProviderInput): Promise<LlmProviderItem> {
    return this.http.request<LlmProviderItem>("PUT", `/api/llm-providers/${id}`, input);
  }

  /** Delete an LLM provider */
  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/llm-providers/${id}`);
  }

  /** Refresh models for a provider */
  async refreshModels(id: string): Promise<LlmProviderItem> {
    return this.http.post<LlmProviderItem>(`/api/llm-providers/${id}/refresh-models`);
  }
}
