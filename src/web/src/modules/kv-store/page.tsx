import type { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Input, Spin } from "antd";
import { Key, Search } from "lucide-react";
import { useMemo, useRef } from "react";
import { agentHandsGridTheme, formatTTL } from "./common/utils";
import AddVariableButton from "./components/AddVariableButton";
import KvDocsModal from "./components/KvDocsModal";
import PurgeButton from "./components/PurgeButton";
import { useKvStore } from "./hooks/useKvStore";

// ══════════════════════════════════════════════════════════════════════════════
//  KV STORE PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function KvStorePage() {
  const gridRef = useRef<AgGridReact>(null);

  const {
    variables,
    loading,
    searchText,
    pagination,
    selectedIds,
    fetchVariables,
    handleSearchChange,
    handlePurged,
    goToPrevPage,
    goToNextPage,
    onGridReady,
    onSelectionChanged,
    onCellValueChanged,
  } = useKvStore();

  // ── Grid Columns ──────────────────────────────────────────────────────────────

  const agColDefs: ColDef[] = useMemo(
    () => [
      {
        field: "key",
        headerName: "KEY",
        checkboxSelection: true,
        headerCheckboxSelection: true,
        minWidth: 200,
        editable: false,
        valueFormatter: (params) => String(params.value),
      },
      {
        field: "value",
        headerName: "VALUE",
        flex: 1,
        minWidth: 200,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
      },
      {
        field: "ttl",
        headerName: "TTL",
        width: 140,
        editable: false,
        valueGetter: (params) => {
          if (!params.data.expiresAt) return "—";
          return formatTTL(params.data.expiresAt);
        },
      },
    ],
    [],
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Config / KV Store</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[24px] md:text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">KV Store</h1>
            <p className="text-[13px] text-muted mt-2 m-0 leading-relaxed">
              Key-value store with optional TTL. Use key prefixes for organization (e.g.{" "}
              <code className="text-[11px] bg-canvas px-1 py-0.5 rounded border border-hairline">config.api_url</code>,{" "}
              <code className="text-[11px] bg-canvas px-1 py-0.5 rounded border border-hairline">cache.token</code>).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <KvDocsModal />
            <PurgeButton selectedIds={selectedIds} onPurged={handlePurged} />
            <AddVariableButton onCreated={fetchVariables} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 shrink-0">
        <Input
          placeholder="Search by key…"
          prefix={<Search size={14} style={{ color: "var(--color-muted-soft)" }} />}
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ maxWidth: 320 }}
          allowClear
        />
      </div>

      {/* Grid */}
      <div className="flex-1 mx-8 mb-0" style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-hairline)" }}>
        {loading && variables.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" />
          </div>
        ) : (
          <div className="h-full w-full ag-theme-gomustack">
            <AgGridReact
              ref={gridRef}
              theme={agentHandsGridTheme}
              rowData={variables}
              columnDefs={agColDefs}
              getRowId={(params) => params.data.id}
              rowSelection="multiple"
              suppressRowClickSelection
              onGridReady={onGridReady}
              onSelectionChanged={onSelectionChanged}
              onCellValueChanged={onCellValueChanged}
              animateRows
              undoRedoCellEditing
              stopEditingWhenCellsLoseFocus
              defaultColDef={{
                resizable: true,
                sortable: true,
              }}
              rowHeight={36}
              headerHeight={34}
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex justify-between items-center px-8 py-4 shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
            {pagination.total} RECORD{pagination.total !== 1 ? "S" : ""}
          </span>
          <div className="flex items-center gap-4">
            <button
              disabled={pagination.page <= 1}
              onClick={goToPrevPage}
              className="font-mono text-[11px] uppercase tracking-wide text-ink cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none p-0 hover:underline"
            >
              Previous
            </button>
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
              Page {pagination.page} / {totalPages}
            </span>
            <button
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={goToNextPage}
              className="font-mono text-[11px] uppercase tracking-wide text-ink cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none p-0 hover:underline"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
