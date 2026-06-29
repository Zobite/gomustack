import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Users ─────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),         // usr_xxxx
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── API Keys ──────────────────────────────────────────────────────────────────
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),           // key_xxxx
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),       // first 8 chars of raw key (ltk_xxxx)
  userId: text("user_id").notNull(),
  permissions: text("permissions").notNull().default('["*"]'),  // JSON array
  lastUsedAt: int("last_used_at"),
  expiresAt: int("expires_at"),           // epoch ms, null = never expires
  createdAt: int("created_at").notNull(),
});

// ─── Variable Namespaces ───────────────────────────────────────────────────────
export const variableNamespaces = sqliteTable("variable_projects", {
  id: text("id").primaryKey(),             // vns_xxxx
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── KV Store (Key-Value Store) ─────────────────────────────────────────────
export const variables = sqliteTable("variables", {
  id: text("id").primaryKey(),          // var_xxxx
  projectId: text("project_id"),        // legacy field — always null (namespace removed)
  key: text("key").notNull(),
  value: text("value").notNull(),       // stored as text regardless of type
  type: text("type", { enum: ["string", "number", "boolean", "json"] })
    .notNull()
    .default("string"),
  ttl: int("ttl"),                      // seconds, null/0 = no expiry
  expiresAt: int("expires_at"),         // epoch ms, null = persistent
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── DataTable Projects (grouping for Dynamic Tables) ──────────────────────────
export const datatableProjects = sqliteTable("databases_v2", {
  id: text("id").primaryKey(),             // prj_xxxx
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Dynamic Tables ────────────────────────────────────────────────────────────
export const dynamicTables = sqliteTable("dynamic_tables", {
  id: text("id").primaryKey(),            // dtb_xxxx
  projectId: text("database_id"),         // optional: group under a project
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  columns: text("columns").notNull().default("[]"),  // JSON: ColumnDef[]
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

export const dynamicTableRows = sqliteTable("dynamic_table_rows", {
  id: text("id").primaryKey(),            // dtr_xxxx
  tableId: text("table_id").notNull(),
  data: text("data").notNull().default("{}"),  // JSON: { colId: value }
  createdBy: text("created_by"),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Projects ──────────────────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),             // prj_xxxx
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Documents ─────────────────────────────────────────────────────────────────
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),             // doc_xxxx
  projectId: text("project_id"),           // scoped under a project
  title: text("title").notNull().default("Untitled"),
  icon: text("icon"),
  cover: text("cover"),
  content: text("content").notNull().default(""), // markdown text
  parentId: text("parent_id"),             // for nested sub-pages (future)
  isPublic: int("is_public").notNull().default(0),
  createdBy: text("created_by").notNull(),
  order: real("order").notNull().default(0),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Storage: Buckets ──────────────────────────────────────────────────────────
export const buckets = sqliteTable("buckets", {
  id: text("id").primaryKey(),             // bkt_xxxx
  name: text("name").notNull().unique(),
  isPublic: int("is_public").notNull().default(0),
  createdAt: int("created_at").notNull(),
});

// ─── Storage: Objects ──────────────────────────────────────────────────────────
export const objects = sqliteTable("objects", {
  id: text("id").primaryKey(),             // obj_xxxx
  bucketId: text("bucket_id").notNull(),
  key: text("key").notNull(),              // e.g. images/avatars/user1.png
  size: int("size").notNull().default(0),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  etag: text("etag").notNull(),            // MD5 hash
  isPublic: int("is_public").notNull().default(0),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Storage: Access Keys (S3 API auth) ────────────────────────────────────────
export const storageAccessKeys = sqliteTable("storage_access_keys", {
  id: text("id").primaryKey(),             // sak_xxxx
  accessKey: text("access_key").notNull().unique(),   // 20 chars
  secretKeyHash: text("secret_key_hash").notNull(),
  label: text("label").notNull().default(""),
  isActive: int("is_active").notNull().default(1),
  createdAt: int("created_at").notNull(),
});

// ─── MCP Tool Servers ──────────────────────────────────────────────────────────
export const mcpToolServers = sqliteTable("mcp_tool_servers", {
  id: text("id").primaryKey(),              // mts_xxxx
  name: text("name").notNull().unique(),
  description: text("description"),
  type: text("type", { enum: ["builtin", "custom"] })
    .notNull()
    .default("custom"),
  isActive: int("is_active").notNull().default(1),
  extendsBuiltin: text("extends_builtin").notNull().default("[]"),
  apiKeyHash: text("api_key_hash"),          // SHA-256 hash of msk_xxx key
  apiKeyPrefix: text("api_key_prefix"),      // first 8 chars (msk_xxxx) for display
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── MCP Tools ─────────────────────────────────────────────────────────────────
export const mcpTools = sqliteTable("mcp_tools", {
  id: text("id").primaryKey(),              // mtl_xxxx
  serverId: text("server_id").notNull(),    // FK → mcp_tool_servers
  name: text("name").notNull(),             // snake_case tool name
  description: text("description").notNull().default(""),
  inputSchema: text("input_schema"),        // JSON Schema string
  code: text("code").notNull().default(""),  // Python source code
  draftCode: text("draft_code"),             // AI-generated draft code (pending review)
  isActive: int("is_active").notNull().default(1),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── MCP Tool Logs ─────────────────────────────────────────────────────────────
export const mcpToolLogs = sqliteTable("mcp_tool_logs", {
  id: text("id").primaryKey(),              // mtlg_xxxx
  toolId: text("tool_id").notNull(),        // FK → mcp_tools
  serverId: text("server_id").notNull(),    // FK → mcp_tool_servers
  callerType: text("caller_type", { enum: ["mcp_agent", "test_panel"] })
    .notNull()
    .default("test_panel"),
  callerInfo: text("caller_info"),          // agent name or user info
  inputParams: text("input_params"),        // JSON
  outputResult: text("output_result"),      // JSON
  status: text("status", { enum: ["success", "error"] }).notNull().default("success"),
  errorMessage: text("error_message"),
  executionTimeMs: int("execution_time_ms").notNull().default(0),
  createdAt: int("created_at").notNull(),
});

// ─── Dynamic API Endpoints ─────────────────────────────────────────────────────
export const dynamicApis = sqliteTable("dynamic_apis", {
  id: text("id").primaryKey(),              // dap_xxxx
  name: text("name").notNull(),
  method: text("method", { enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] })
    .notNull()
    .default("GET"),
  path: text("path").notNull(),              // e.g. /users/:id
  description: text("description"),
  code: text("code").notNull().default(""),   // JS/TS source code
  draftCode: text("draft_code"),             // AI-generated draft code (pending review)
  dependencies: text("dependencies"),         // JSON: { "axios": "^1.7.0" } or null
  isActive: int("is_active").notNull().default(1),
  timeout: int("timeout").notNull().default(30000),  // ms
  isPublic: int("is_public").notNull().default(0),   // 0 = requires auth, 1 = public
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Dynamic API Logs ──────────────────────────────────────────────────────────
export const dynamicApiLogs = sqliteTable("dynamic_api_logs", {
  id: text("id").primaryKey(),              // dal_xxxx
  apiId: text("api_id").notNull(),           // FK → dynamic_apis
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: int("status_code").notNull(),
  executionTimeMs: int("execution_time_ms").notNull(),
  executionMode: text("execution_mode", { enum: ["fast", "isolated"] }).notNull(),
  requestHeaders: text("request_headers"),    // JSON
  requestBody: text("request_body"),          // JSON
  responseBody: text("response_body"),        // JSON (truncated)
  consoleOutput: text("console_output"),      // captured console.log/error
  error: text("error"),                       // error message if any
  ip: text("ip"),
  createdAt: int("created_at").notNull(),
});

// ─── LLM Providers ─────────────────────────────────────────────────────────────
export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(),              // llm_xxxx
  name: text("name").notNull(),
  providerType: text("provider_type", {
    enum: ["openrouter", "openai", "gemini", "anthropic", "ollama", "custom"],
  }).notNull(),
  apiKey: text("api_key").notNull().default(""),
  baseUrl: text("base_url"),                 // null → use default
  models: text("models").notNull().default("[]"), // JSON: { id, name }[]
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Configurations ────────────────────────────────────────────────────────
export const configurations = sqliteTable("configurations", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Browser Profiles ──────────────────────────────────────────────────────────
export const browserProfiles = sqliteTable("browser_profiles", {
  id: text("id").primaryKey(),              // bpr_xxxx
  name: text("name").notNull(),
  description: text("description"),
  userDataDir: text("user_data_dir").notNull(), // Absolute path to storage folder
  proxyConfig: text("proxy_config"),            // JSON string: { server, username, password }
  fingerprintConfig: text("fingerprint_config"),// JSON string: { userAgent, viewport: { width, height }, locale, timezoneId, geolocation: { latitude, longitude } }
  status: text("status", { enum: ["idle", "running", "error"] })
    .notNull()
    .default("idle"),
  cdpPort: int("cdp_port"),
  wsEndpoint: text("ws_endpoint"),
  pid: int("pid"),
  createdBy: text("created_by").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
/** @deprecated Namespace table kept for migration compat — no longer used */
export type VariableNamespace = typeof variableNamespaces.$inferSelect;
/** @deprecated */
export type InsertVariableNamespace = typeof variableNamespaces.$inferInsert;
export type Variable = typeof variables.$inferSelect;
export type InsertVariable = typeof variables.$inferInsert;
export type DatatableProject = typeof datatableProjects.$inferSelect;
export type InsertDatatableProject = typeof datatableProjects.$inferInsert;
export type DynamicTable = typeof dynamicTables.$inferSelect;
export type InsertDynamicTable = typeof dynamicTables.$inferInsert;
export type DynamicTableRow = typeof dynamicTableRows.$inferSelect;
export type InsertDynamicTableRow = typeof dynamicTableRows.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type Bucket = typeof buckets.$inferSelect;
export type InsertBucket = typeof buckets.$inferInsert;
export type StorageObject = typeof objects.$inferSelect;
export type InsertStorageObject = typeof objects.$inferInsert;
export type StorageAccessKey = typeof storageAccessKeys.$inferSelect;
export type InsertStorageAccessKey = typeof storageAccessKeys.$inferInsert;
export type McpToolServer = typeof mcpToolServers.$inferSelect;
export type InsertMcpToolServer = typeof mcpToolServers.$inferInsert;
export type McpTool = typeof mcpTools.$inferSelect;
export type InsertMcpTool = typeof mcpTools.$inferInsert;
export type McpToolLog = typeof mcpToolLogs.$inferSelect;
export type InsertMcpToolLog = typeof mcpToolLogs.$inferInsert;
export type DynamicApi = typeof dynamicApis.$inferSelect;
export type InsertDynamicApi = typeof dynamicApis.$inferInsert;
export type DynamicApiLog = typeof dynamicApiLogs.$inferSelect;
export type InsertDynamicApiLog = typeof dynamicApiLogs.$inferInsert;
export type LlmProvider = typeof llmProviders.$inferSelect;
export type InsertLlmProvider = typeof llmProviders.$inferInsert;
export type Configuration = typeof configurations.$inferSelect;
export type InsertConfiguration = typeof configurations.$inferInsert;
export type BrowserProfile = typeof browserProfiles.$inferSelect;
export type InsertBrowserProfile = typeof browserProfiles.$inferInsert;
