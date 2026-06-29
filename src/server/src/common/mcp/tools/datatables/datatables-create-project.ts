import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesCreateProject(server: McpServer) {
  server.registerTool(
    "datatables_create_project",
    {
      description: "Create a new datatable project. Projects are containers for tables. Returns the created project with id, name, description, and tableCount.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .max(255)
          .describe("Project name (e.g. 'My Project')"),
        description: z
          .string()
          .max(1000)
          .optional()
          .describe("Optional description of the project"),
      },
    },
    async ({ name, description }) => {
      try {
        const { createProject } = await import(
          "../../../../modules/datatables/project.service.js"
        );
        const result = await createProject(
          { name, description },
          "usr_mcp_system",
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal error";
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    },
  );
}
