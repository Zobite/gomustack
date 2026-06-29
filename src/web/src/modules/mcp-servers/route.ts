import { lazy } from "react";
import type { ModuleNav, ModuleRoute } from "src/common/types/router";

const McpServersListPage = lazy(() => import("./pages/McpServersListPage"));
const McpServerDetailPage = lazy(() => import("./pages/McpServerDetailPage"));
const McpToolEditorPage = lazy(() => import("./pages/McpToolEditorPage"));

export const routes: ModuleRoute[] = [
  {
    path: "/mcp-servers",
    element: McpServersListPage,
  },
  {
    path: "/mcp-servers/:id",
    element: McpServerDetailPage,
  },
  {
    path: "/mcp-servers/:id/tools/:toolId",
    element: McpToolEditorPage,
  },
];

export const nav: ModuleNav = {
  label: "MCP Servers",
  icon: "plug",
  order: 8,
};
