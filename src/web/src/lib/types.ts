// ── Shared Types ─────────────────────────────────────────────────────────────

/** @deprecated — no longer used, server returns data directly */
export interface ApiResponse<T> {
  data: T;
}

/** Standard API list response */
export interface ApiListResponse<T> {
  items: T[];
  meta?: { total: number; limit: number; offset: number };
}

/** Standard API error response */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown[];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  login: string; // username or email
  password: string;
}

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RefreshResult {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string | null;
  email: string;
  name: string;
  role: "admin" | "member";
  createdAt: number;
  updatedAt: number;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  name: string;
  role?: "admin" | "member";
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  name?: string;
  password?: string;
  role?: "admin" | "member";
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

// ── API Keys ────────────────────────────────────────────────────────────────

export interface ApiKeyItem {
  id: string;
  name: string;
  userId: string;
  permissions: string[];
  lastUsedAt: number | null;
  expiresAt: number | null;
  createdAt: number;
}

export interface ApiKeyCreated extends ApiKeyItem {
  /** Raw API key — shown only once */
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
  permissions?: string[];
  expiresAt?: number;
}

// ── KV Store ─────────────────────────────────────────────────────────────────

export interface Variable {
  id: string;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  ttl: number | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateVariableInput {
  key: string;
  value: string;
  type?: "string" | "number" | "boolean" | "json";
  ttl?: number;
}

export interface UpdateVariableInput {
  value?: string;
  type?: "string" | "number" | "boolean" | "json";
  ttl?: number | null;
}

export interface VariableListQuery {
  search?: string;
  sort?: "key" | "type" | "updated_at" | "ttl";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface VariableListResult {
  items: Variable[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// ── Dynamic Tables ──────────────────────────────────────────────────────────

export type ColumnType = "text" | "number" | "date" | "boolean";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty";

export interface FilterCondition {
  columnId?: string; // internal column ID (col_xxx) — used by UI
  column?: string; // column name (human-readable) — used by LLMs/API
  operator: FilterOperator;
  value?: unknown;
}

export interface ColumnOptions {
  numberFormat?: "integer" | "decimal" | "currency" | "percent";
  includeTime?: boolean;
}

export interface ColumnDef {
  id: string;
  name: string;
  type: ColumnType;
  order: number;
  required: boolean;
  options: ColumnOptions;
}

export interface DynamicTable {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  projectId: string | null;
  columns: ColumnDef[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  rowCount: number;
}

export interface DynamicTableRow {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTableInput {
  name: string;
  description?: string;
  icon?: string;
  columns: { name: string; type: ColumnType; options?: ColumnOptions }[];
}

export interface UpdateTableInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
}

export interface AddColumnInput {
  name: string;
  type: ColumnType;
  options?: ColumnOptions;
}

export interface UpdateColumnInput {
  name?: string;
  type?: ColumnType;
  options?: ColumnOptions;
}

export interface CreateRowInput {
  data?: Record<string, unknown>;
}

export interface UpdateRowInput {
  data: Record<string, unknown>;
}

export interface RowListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  filter?: FilterCondition[];
  filterLogic?: "and" | "or";
}

export interface RowListResult {
  items: DynamicTableRow[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// ── DataTable Projects (grouping for tables) ───────────────────────────────────

export interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tableCount: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
}


// ── Storage ─────────────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: number;
  objectCount: number;
  totalSize: number;
}

export interface StorageObject {
  id: string;
  bucketId: string;
  key: string;
  size: number;
  contentType: string;
  etag: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateBucketInput {
  name: string;
  isPublic?: boolean;
}

export interface UpdateBucketInput {
  isPublic: boolean;
}

export interface ObjectListQuery {
  prefix?: string;
  delimiter?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ObjectListResult {
  items: StorageObject[];
  commonPrefixes: string[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface UploadResult {
  id: string;
  key: string;
  etag: string;
  size: number;
  contentType: string;
}

export interface PresignResult {
  url: string;
  expiresAt: number;
}

export interface StorageAccessKeyItem {
  id: string;
  accessKey: string;
  label: string;
  isActive: boolean;
  createdAt: number;
}

export interface StorageAccessKeyCreated extends StorageAccessKeyItem {
  /** Raw secret key — shown only once */
  secretKey: string;
}

export interface CreateStorageAccessKeyInput {
  label: string;
}

export interface UpdateStorageAccessKeyInput {
  label?: string;
  isActive?: boolean;
}

export interface StorageStats {
  bucketCount: number;
  objectCount: number;
  totalSize: number;
}

export interface BucketListResult {
  items: Bucket[];
  meta: { total: number };
}

// ── MCP Tool Servers ────────────────────────────────────────────────────────

export interface McpToolServerItem {
  id: string;
  name: string;
  description: string | null;
  type: "builtin" | "custom";
  isActive: number;
  extendsBuiltin: string[];
  hasApiKey: boolean;
  apiKey?: string; // raw key — only present immediately after create/regenerate
  createdAt: number;
  updatedAt: number;
  toolCount: number;
}

export interface CreateMcpServerInput {
  name: string;
  description?: string;
  extendsBuiltin?: string[];
}

export interface UpdateMcpServerInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  extendsBuiltin?: string[];
}

// ── MCP Tools ───────────────────────────────────────────────────────────────

export interface McpToolItem {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: string | null;
  code: string;
  draftCode: string | null;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMcpToolInput {
  name: string;
  description?: string;
  inputSchema?: string;
  code?: string;
}

export interface UpdateMcpToolInput {
  name?: string;
  description?: string;
  inputSchema?: string | null;
  code?: string;
  draftCode?: string | null;
  isActive?: boolean;
}

export interface McpToolListQuery {
  page?: number;
  limit?: number;
}

export interface McpToolListResult {
  items: McpToolItem[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface McpToolTestResult {
  success: boolean;
  result: unknown;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
}

export interface McpToolLog {
  id: string;
  toolId: string;
  serverId: string;
  callerType: "mcp_agent" | "test_panel";
  callerInfo: string | null;
  inputParams: unknown;
  outputResult: unknown;
  status: "success" | "error";
  errorMessage: string | null;
  executionTimeMs: number;
  createdAt: number;
}

export interface McpToolLogListResult {
  items: McpToolLog[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// ── Dynamic APIs ────────────────────────────────────────────────────────────

export interface DynamicApiItem {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string | null;
  code: string;
  draftCode: string | null;
  dependencies: Record<string, string> | null;
  isActive: boolean;
  isPublic: boolean;
  timeout: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDynamicApiInput {
  name: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description?: string;
  code?: string;
  dependencies?: Record<string, string>;
  isPublic?: boolean;
  timeout?: number;
}

export interface UpdateDynamicApiInput {
  name?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  description?: string | null;
  code?: string;
  draftCode?: string | null;
  dependencies?: Record<string, string> | null;
  isActive?: boolean;
  isPublic?: boolean;
  timeout?: number;
}

export interface DynamicApiListQuery {
  search?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  status?: "active" | "inactive";
  page?: number;
  limit?: number;
}

export interface DynamicApiListResult {
  items: DynamicApiItem[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

export interface DynamicApiLogItem {
  id: string;
  apiId: string;
  method: string;
  path: string;
  statusCode: number;
  executionTimeMs: number;
  executionMode: "fast" | "isolated";
  requestHeaders: string | null;
  requestBody: string | null;
  responseBody: string | null;
  consoleOutput: string | null;
  error: string | null;
  ip: string | null;
  createdAt: number;
}

export interface DynamicApiLogListResult {
  items: DynamicApiLogItem[];
  meta: { total: number; page: number; limit: number; hasMore: boolean };
}

// ── LLM Providers ───────────────────────────────────────────────────────────

export type LlmProviderType = "openrouter" | "openai" | "gemini" | "anthropic" | "ollama" | "custom";

export interface LlmProviderItem {
  id: string;
  name: string;
  providerType: LlmProviderType;
  apiKey: string; // masked
  baseUrl: string | null;
  models: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateLlmProviderInput {
  name: string;
  providerType: LlmProviderType;
  apiKey: string;
  baseUrl?: string;
}

export interface UpdateLlmProviderInput {
  name?: string;
  apiKey?: string;
  baseUrl?: string | null;
}
