import type { HttpClient } from "../http";

export interface ConfigurationItem {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}

export class ConfigurationsResource {
  constructor(private http: HttpClient) {}

  async get(key: string): Promise<ConfigurationItem | null> {
    try {
      return await this.http.get<ConfigurationItem>(`/api/configurations/${key}`);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<ConfigurationItem> {
    return this.http.request<ConfigurationItem>("PUT", `/api/configurations/${key}`, { value });
  }

  async delete(key: string): Promise<void> {
    await this.http.delete(`/api/configurations/${key}`);
  }

  async batchGet(keys: string[]): Promise<Record<string, string>> {
    const res = await this.http.post<{ values: Record<string, string> }>("/api/configurations/batch-get", { keys });
    return res.values;
  }
}
