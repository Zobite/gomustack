import type { Migration } from "../migrate.js";

const migration: Migration = {
  name: "0006_mcp",
  up: [
    `CREATE TABLE IF NOT EXISTS mcp_tool_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'custom',
      is_active INTEGER NOT NULL DEFAULT 1,
      extends_builtin TEXT NOT NULL DEFAULT '[]',
      api_key_hash TEXT,
      api_key_prefix TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,

    // Seed built-in GomuStack system tools server
    `INSERT OR IGNORE INTO mcp_tool_servers (id, name, description, type, is_active, created_at, updated_at)
     VALUES ('mts_system', 'GomuStack', 'Built-in MCP server providing system tools for AI agents to interact with Variables, Tables, Documents, and Storage.', 'builtin', 1, (unixepoch() * 1000), (unixepoch() * 1000))`,

    `CREATE TABLE IF NOT EXISTS mcp_tools (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES mcp_tool_servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      input_schema TEXT,
      code TEXT NOT NULL DEFAULT '',
      draft_code TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_id ON mcp_tools(server_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_tools_server_name ON mcp_tools(server_id, name)`,

    `CREATE TABLE IF NOT EXISTS mcp_tool_logs (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      caller_type TEXT NOT NULL DEFAULT 'test_panel',
      caller_info TEXT,
      input_params TEXT,
      output_result TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_tool_id ON mcp_tool_logs(tool_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mcp_tool_logs_created_at ON mcp_tool_logs(created_at)`,
  ],
};

export default migration;
