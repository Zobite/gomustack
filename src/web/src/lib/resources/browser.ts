import type { HttpClient } from "../http";

export interface BrowserProfileItem {
  id: string;
  name: string;
  description: string | null;
  userDataDir: string;
  proxyConfig: string | null; // Stored as JSON string
  fingerprintConfig: string | null; // Stored as JSON string
  status: "idle" | "running" | "error";
  cdpPort: number | null;
  wsEndpoint: string | null;
  tabCount: number;
  memoryMB: number;
  createdAt: number;
  updatedAt: number;
}

export interface ListProfilesResponse {
  items: BrowserProfileItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export class BrowserProfilesResource {
  constructor(private http: HttpClient) {}

  /** List browser profiles */
  async list(query?: { page?: number; limit?: number; search?: string }): Promise<ListProfilesResponse> {
    const q = new URLSearchParams();
    if (query?.page) q.append("page", String(query.page));
    if (query?.limit) q.append("limit", String(query.limit));
    if (query?.search) q.append("search", query.search);

    const path = `/api/browsers${q.toString() ? `?${q.toString()}` : ""}`;
    return this.http.get<ListProfilesResponse>(path);
  }

  /** Get a single profile's details */
  async get(id: string): Promise<BrowserProfileItem & { tabs?: Array<{ index: number; url: string; title: string }> }> {
    return this.http.get<any>(`/api/browsers/${id}`);
  }

  /** Get a running profile's active tabs */
  async getTabs(id: string): Promise<Array<{ index: number; url: string; title: string }>> {
    return this.http.get<any>(`/api/browsers/${id}/tabs`);
  }

  /** Create a browser profile */
  async create(body: {
    name: string;
    description?: string;
    proxyConfig?: any;
    fingerprintConfig?: any;
  }): Promise<BrowserProfileItem> {
    return this.http.post<BrowserProfileItem>("/api/browsers", body);
  }

  /** Update an idle browser profile */
  async update(
    id: string,
    body: {
      name?: string;
      description?: string | null;
      proxyConfig?: any;
      fingerprintConfig?: any;
    },
  ): Promise<BrowserProfileItem> {
    return this.http.patch<BrowserProfileItem>(`/api/browsers/${id}`, body);
  }

  /** Delete a browser profile and clean files */
  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`/api/browsers/${id}`);
  }

  /** Start the persistent browser profile process */
  async start(id: string): Promise<{ id: string; status: string; cdpPort: number; wsEndpoint: string }> {
    return this.http.post<{ id: string; status: string; cdpPort: number; wsEndpoint: string }>(`/api/browsers/${id}/start`);
  }

  /** Stop the persistent browser profile process */
  async stop(id: string): Promise<{ id: string; stopped: boolean }> {
    return this.http.post<{ id: string; stopped: boolean }>(`/api/browsers/${id}/stop`);
  }

  /** Execute a sequence of browser actions on a profile */
  async runSteps(
    profileId: string,
    body: {
      tabIndex?: number;
      steps: Array<{
        action: "navigate" | "click" | "type" | "screenshot" | "get_content" | "eval" | "wait";
        url?: string;
        selector?: string;
        text?: string;
        code?: string;
        timeout?: number;
      }>;
    },
  ): Promise<any> {
    return this.http.post<any>(`/api/browsers/${profileId}/control`, body);
  }

  /** Helper to load live screenshot directly as a blob URL for a specific tab */
  async getScreenshotBlobUrl(id: string, tabIndex?: number): Promise<string> {
    const baseUrl = (this.http as any)._baseUrl;
    const token = this.http.accessToken;

    const urlSuffix = tabIndex !== undefined ? `?tabIndex=${tabIndex}` : "";
    const res = await fetch(`${baseUrl}/api/browsers/${id}/screenshot${urlSuffix}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Screenshot not available");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
}
