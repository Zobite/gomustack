import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDatatablesListProjects(server: McpServer) {
  server.registerTool(
    "datatables_list_projects",
      {
        description: "List all datatable projects. Returns an array of projects with id, name, description, and table count.",
      },
    async () => {
      try {
        const { listProjects } = await import(
          "../../../../modules/datatables/project.service.js"
        );
        const result = await listProjects();
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
