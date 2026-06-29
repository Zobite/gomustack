import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllSystemTools } from "./tools.js";

const SERVER_NAME = "gomustack";
const SERVER_VERSION = "0.1.0";

// System user for MCP-initiated writes
export const MCP_USER_ID = "usr_mcp_system";

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  // Register all built-in system tools
  registerAllSystemTools(server);

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[MCP] GomuStack MCP server running on stdio\n");
}
