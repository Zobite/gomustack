import { type ClientOptions, HttpClient } from "./http";
import { ApiKeysResource } from "./resources/api-key";
import { AuthResource } from "./resources/auth";
import { BrowserProfilesResource } from "./resources/browser";
import { ConfigurationsResource } from "./resources/configuration";
import { ProjectsResource } from "./resources/database";
import { DynamicApisResource } from "./resources/dynamic-api";
import { KvStoreResource } from "./resources/kv-store";
import { LlmProvidersResource } from "./resources/llm-provider";
import { McpToolServersResource } from "./resources/mcp-tool-server";
import { StorageResource } from "./resources/storage";
import { SystemResource } from "./resources/system";
import { TablesResource } from "./resources/table";
import { UsersResource } from "./resources/user";

class GomuStackClient {
  private http: HttpClient;

  public readonly auth: AuthResource;
  public readonly users: UsersResource;
  public readonly kvStore: KvStoreResource;
  public readonly tables: TablesResource;
  public readonly projects: ProjectsResource;
  public readonly apiKeys: ApiKeysResource;
  public readonly storage: StorageResource;
  public readonly mcpToolServers: McpToolServersResource;
  public readonly system: SystemResource;
  public readonly dynamicApis: DynamicApisResource;
  public readonly llmProviders: LlmProvidersResource;
  public readonly configurations: ConfigurationsResource;
  public readonly browserProfiles: BrowserProfilesResource;

  constructor(options: ClientOptions) {
    this.http = new HttpClient(options);
    this.auth = new AuthResource(this.http);
    this.users = new UsersResource(this.http);
    this.kvStore = new KvStoreResource(this.http);
    this.tables = new TablesResource(this.http);
    this.projects = new ProjectsResource(this.http);
    this.apiKeys = new ApiKeysResource(this.http);
    this.storage = new StorageResource(this.http);
    this.mcpToolServers = new McpToolServersResource(this.http);
    this.system = new SystemResource(this.http);
    this.dynamicApis = new DynamicApisResource(this.http);
    this.llmProviders = new LlmProvidersResource(this.http);
    this.configurations = new ConfigurationsResource(this.http);
    this.browserProfiles = new BrowserProfilesResource(this.http);
  }

  get accessToken() {
    return this.http.accessToken;
  }

  setTokens(accessToken: string, refreshToken?: string) {
    this.http.setTokens(accessToken, refreshToken);
  }
}

export const API_BASE = import.meta.env.VITE_API_URL || "";

export const client = new GomuStackClient({
  baseUrl: API_BASE,
  onTokenChange: ({ accessToken, refreshToken }) => {
    if (accessToken) {
      localStorage.setItem("access_token", accessToken);
    }
    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    }
  },
  onRefreshFail: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    // Clear zustand persisted auth state so AuthGuard redirects to login on reload
    localStorage.removeItem("auth-storage");
    window.location.href = "/ui";
  },
});

// Restore tokens from localStorage on init
const savedToken = localStorage.getItem("access_token");
const savedRefresh = localStorage.getItem("refresh_token");
if (savedToken) {
  client.setTokens(savedToken, savedRefresh ?? undefined);
}
