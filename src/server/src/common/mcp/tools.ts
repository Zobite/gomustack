/**
 * Register all built-in system tools on the MCP server.
 *
 * Each tool is defined in its own file under ./tools/<category>/.
 * This file simply imports and calls each registration function.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerKvDelete } from "./tools/kv/kv-delete.js";
import { registerKvGet } from "./tools/kv/kv-get.js";
// ── KV Store ───────────────────────────────────────────────────────────────────
import { registerKvList } from "./tools/kv/kv-list.js";
import { registerKvSet } from "./tools/kv/kv-set.js";

import { registerDatatablesAddColumn } from "./tools/datatables/datatables-add-column.js";
import { registerDatatablesBulkDeleteRows } from "./tools/datatables/datatables-bulk-delete-rows.js";
import { registerDatatablesBulkUpdateRows } from "./tools/datatables/datatables-bulk-update-rows.js";
import { registerDatatablesCreateProject } from "./tools/datatables/datatables-create-project.js";
import { registerDatatablesCreateTable } from "./tools/datatables/datatables-create-table.js";
import { registerDatatablesDeleteColumn } from "./tools/datatables/datatables-delete-column.js";
import { registerDatatablesGetRow } from "./tools/datatables/datatables-get-row.js";
import { registerDatatablesInsertRow } from "./tools/datatables/datatables-insert-row.js";
// ── DataTables ─────────────────────────────────────────────────────────────────
import { registerDatatablesListProjects } from "./tools/datatables/datatables-list-projects.js";
import { registerDatatablesListTables } from "./tools/datatables/datatables-list-tables.js";
import { registerDatatablesQueryRows } from "./tools/datatables/datatables-query-rows.js";
import { registerDatatablesUpdateColumn } from "./tools/datatables/datatables-update-column.js";
import { registerDatatablesUpdateTable } from "./tools/datatables/datatables-update-table.js";

import { registerStorageDeleteObject } from "./tools/storage/storage-delete-object.js";
import { registerStorageGetDownloadUrl } from "./tools/storage/storage-get-download-url.js";
import { registerStorageGetObjectInfo } from "./tools/storage/storage-get-object-info.js";
// ── Object Storage ─────────────────────────────────────────────────────────────
import { registerStorageListBuckets } from "./tools/storage/storage-list-buckets.js";
import { registerStorageListObjects } from "./tools/storage/storage-list-objects.js";
import { registerStorageUploadObject } from "./tools/storage/storage-upload-object.js";

import { registerBrowserCreate } from "./tools/browser/browser-create.js";
import { registerBrowserDelete } from "./tools/browser/browser-delete.js";
import { registerBrowserListTabs } from "./tools/browser/browser-list-tabs.js";
// ── Browser Profiles ───────────────────────────────────────────────────────────
import { registerBrowserList } from "./tools/browser/browser-list.js";
import { registerBrowserQuickRun } from "./tools/browser/browser-quick-run.js";
import { registerBrowserRunSteps } from "./tools/browser/browser-run-steps.js";
import { registerBrowserStart } from "./tools/browser/browser-start.js";
import { registerBrowserStop } from "./tools/browser/browser-stop.js";

import { registerDynamicApiCreate } from "./tools/dynamic-apis/dynamic-api-create.js";
import { registerDynamicApiDelete } from "./tools/dynamic-apis/dynamic-api-delete.js";
import { registerDynamicApiGet } from "./tools/dynamic-apis/dynamic-api-get.js";
// ── Dynamic APIs ─────────────────────────────────────────────────────────────
import { registerDynamicApiList } from "./tools/dynamic-apis/dynamic-api-list.js";
import { registerDynamicApiUpdate } from "./tools/dynamic-apis/dynamic-api-update.js";

import { registerMcpServerCreate } from "./tools/mcp-servers/mcp-server-create.js";
import { registerMcpServerDelete } from "./tools/mcp-servers/mcp-server-delete.js";
import { registerMcpServerGet } from "./tools/mcp-servers/mcp-server-get.js";
// ── MCP Servers ──────────────────────────────────────────────────────────────
import { registerMcpServerList } from "./tools/mcp-servers/mcp-server-list.js";
import { registerMcpServerUpdate } from "./tools/mcp-servers/mcp-server-update.js";
import { registerMcpToolCreate } from "./tools/mcp-servers/mcp-tool-create.js";
import { registerMcpToolDelete } from "./tools/mcp-servers/mcp-tool-delete.js";
import { registerMcpToolGet } from "./tools/mcp-servers/mcp-tool-get.js";
import { registerMcpToolList } from "./tools/mcp-servers/mcp-tool-list.js";
import { registerMcpToolTest } from "./tools/mcp-servers/mcp-tool-test.js";
import { registerMcpToolUpdate } from "./tools/mcp-servers/mcp-tool-update.js";

// ── Register All ───────────────────────────────────────────────────────────────

export const SYSTEM_TOOLS_REGISTRY: Record<string, (server: McpServer) => void> = {
  // KV Store
  kv_list: registerKvList,
  kv_get: registerKvGet,
  kv_set: registerKvSet,
  kv_delete: registerKvDelete,

  // DataTables
  datatables_list_projects: registerDatatablesListProjects,
  datatables_create_project: registerDatatablesCreateProject,
  datatables_list_tables: registerDatatablesListTables,
  datatables_create_table: registerDatatablesCreateTable,
  datatables_update_table: registerDatatablesUpdateTable,
  datatables_add_column: registerDatatablesAddColumn,
  datatables_update_column: registerDatatablesUpdateColumn,
  datatables_delete_column: registerDatatablesDeleteColumn,
  datatables_query_rows: registerDatatablesQueryRows,
  datatables_get_row: registerDatatablesGetRow,
  datatables_insert_row: registerDatatablesInsertRow,
  datatables_bulk_update_rows: registerDatatablesBulkUpdateRows,
  datatables_bulk_delete_rows: registerDatatablesBulkDeleteRows,

  // Object Storage
  storage_list_buckets: registerStorageListBuckets,
  storage_list_objects: registerStorageListObjects,
  storage_get_object_info: registerStorageGetObjectInfo,
  storage_get_download_url: registerStorageGetDownloadUrl,
  storage_upload_object: registerStorageUploadObject,
  storage_delete_object: registerStorageDeleteObject,

  // Browser Profiles
  browser_list: registerBrowserList,
  browser_create: registerBrowserCreate,
  browser_start: registerBrowserStart,
  browser_stop: registerBrowserStop,
  browser_delete: registerBrowserDelete,
  browser_list_tabs: registerBrowserListTabs,
  browser_run_steps: registerBrowserRunSteps,
  browser_quick_run: registerBrowserQuickRun,

  // Dynamic APIs
  dynamic_api_list: registerDynamicApiList,
  dynamic_api_get: registerDynamicApiGet,
  dynamic_api_create: registerDynamicApiCreate,
  dynamic_api_update: registerDynamicApiUpdate,
  dynamic_api_delete: registerDynamicApiDelete,

  // MCP Servers
  mcp_server_list: registerMcpServerList,
  mcp_server_get: registerMcpServerGet,
  mcp_server_create: registerMcpServerCreate,
  mcp_server_update: registerMcpServerUpdate,
  mcp_server_delete: registerMcpServerDelete,
  mcp_tool_list: registerMcpToolList,
  mcp_tool_get: registerMcpToolGet,
  mcp_tool_create: registerMcpToolCreate,
  mcp_tool_update: registerMcpToolUpdate,
  mcp_tool_delete: registerMcpToolDelete,
  mcp_tool_test: registerMcpToolTest,
};

export function registerAllSystemTools(server: McpServer) {
  for (const registerFn of Object.values(SYSTEM_TOOLS_REGISTRY)) {
    registerFn(server);
  }
}
