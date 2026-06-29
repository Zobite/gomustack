import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent, ValueParserParams } from "ag-grid-community";
import { themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Dropdown, Form, Input, InputNumber, Modal, Select, Spin, Switch, message } from "antd";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Database,
  Filter,
  Hash,
  MoreHorizontal,
  Pencil,
  Plus,
  Table2,
  ToggleLeft,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type {
  AddColumnInput,
  ColumnDef,
  ColumnType,
  DynamicTable,
  DynamicTableRow,
  FilterCondition,
  FilterOperator,
  ProjectItem,
  UpdateColumnInput,
  UpdateTableInput,
} from "src/lib/types";
import DatatableDocsModal from "../components/DatatableDocsModal";

const { confirm } = Modal;

// ── AG Grid custom theme based on GomuStack design tokens ──

const agentHandsTheme = themeQuartz.withParams({
  accentColor: "#26251e",
  backgroundColor: "#ffffff",
  foregroundColor: "#26251e",
  borderColor: "#e6e5e0",
  chromeBackgroundColor: "#fafaf7",
  headerBackgroundColor: "#fafaf7",
  headerTextColor: "#807d72",
  headerFontSize: 11,
  rowHoverColor: "#f7f7f4",
  selectedRowBackgroundColor: "#f0efeb",
  cellHorizontalPaddingScale: 1,
  fontSize: 13,
  fontFamily: "'Inter', system-ui, sans-serif",
  borderRadius: 0,
  wrapperBorderRadius: 0,
  spacing: 6,
});

// ── Helpers ──

const COLUMN_TYPE_CONFIG: Record<ColumnType, { icon: React.ReactNode; label: string }> = {
  text: { icon: <Type size={14} />, label: "Text" },
  number: { icon: <Hash size={14} />, label: "Number" },
  date: { icon: <Calendar size={14} />, label: "Date" },
  boolean: { icon: <ToggleLeft size={14} />, label: "Boolean" },
};

const COLUMN_TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

const FILTER_OPERATORS_BY_TYPE: Record<ColumnType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  date: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
    { value: "gt", label: "after" },
    { value: "lt", label: "before" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  boolean: [
    { value: "eq", label: "is" },
    { value: "neq", label: "is not" },
  ],
};

const NO_VALUE_OPERATORS: FilterOperator[] = ["is_empty", "is_not_empty"];

// ══════════════════════════════════════════════════════════════════════════════
//  DATABASE DETAIL PAGE — Notion-style tabbed view + AG Grid
// ══════════════════════════════════════════════════════════════════════════════

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── Database + Tables state ──
  const [project, setDatabase] = useState<ProjectItem | null>(null);
  const [tables, setTables] = useState<DynamicTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);

  // ── Active table tab ──
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  // ── Rows state ──
  const [rows, setRows] = useState<DynamicTableRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  // ── AG Grid ref ──
  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  // ── Modal states ──
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [editTable, setEditTable] = useState<DynamicTable | null>(null);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editColumn, setEditColumn] = useState<ColumnDef | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  // ── Filter/Sort state ──
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterLogic, setFilterLogic] = useState<"and" | "or">("and");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // ── Fetch Database ──
  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const db = await client.projects.get(id);
      setDatabase(db);
    } catch {
      message.error("Project not found");
      navigate("/datatables");
    }
  }, [id, navigate]);

  // ── Fetch Tables ──
  const fetchTables = useCallback(async () => {
    if (!id) return;
    setTablesLoading(true);
    try {
      const data = await client.tables.list(id);
      setTables(data);
      if (data.length > 0) {
        setActiveTableId((prev) => {
          if (prev && data.find((t) => t.id === prev)) return prev;
          return data[0].id;
        });
      } else {
        setActiveTableId(null);
      }
    } catch {
      message.error("Failed to load tables");
    } finally {
      setTablesLoading(false);
    }
  }, [id]);

  // ── Fetch Rows ──
  const fetchRows = useCallback(async () => {
    if (!id || !activeTableId) return;
    setRowsLoading(true);
    try {
      const result = await client.tables.listRows(id, activeTableId, {
        page: pagination.page,
        limit: pagination.limit,
        sort: sortColumn || undefined,
        order: sortColumn ? sortDirection : undefined,
        filter: filters.length > 0 ? filters : undefined,
        filterLogic: filters.length > 1 ? filterLogic : undefined,
      });
      setRows(result.items);
      setPagination((prev) => ({ ...prev, total: result.meta.total }));
    } catch {
      message.error("Failed to load rows");
    } finally {
      setRowsLoading(false);
    }
  }, [id, activeTableId, pagination.page, pagination.limit, sortColumn, sortDirection, filters, filterLogic]);

  // ── Refetch active table metadata ──
  const refetchActiveTable = useCallback(async () => {
    if (!id || !activeTableId) return;
    try {
      const t = await client.tables.get(id, activeTableId);
      setTables((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    } catch {
      // ignore
    }
  }, [id, activeTableId]);

  // ── Effects ──
  useEffect(() => {
    setLoading(true);
    fetchProject().finally(() => setLoading(false));
  }, [fetchProject]);

  useEffect(() => {
    if (project) fetchTables();
  }, [project, fetchTables]);

  useEffect(() => {
    if (activeTableId) {
      setPagination((p) => ({ ...p, page: 1 }));
      // Reset filter/sort when switching tables
      setFilters([]);
      setSortColumn("");
      setSortDirection("asc");
    }
  }, [activeTableId]);

  useEffect(() => {
    if (activeTableId) fetchRows();
  }, [activeTableId, fetchRows]);

  // ── Active table object ──
  const activeTable = tables.find((t) => t.id === activeTableId) ?? null;
  const tableColumns = activeTable ? [...activeTable.columns].sort((a, b) => a.order - b.order) : [];

  // ── AG Grid Column Defs ──
  const agColDefs: ColDef[] = useMemo(() => {
    if (!activeTable) return [];
    const cols: ColDef[] = tableColumns.map((col) => {
      const base: ColDef = {
        headerName: col.name.toUpperCase(),
        field: col.id,
        editable: true,
        resizable: true,
        sortable: true,
        minWidth: 140,
        flex: 1,
      };

      switch (col.type) {
        case "number":
          return {
            ...base,
            cellDataType: "number",
            valueParser: (params: ValueParserParams) => {
              const val = Number(params.newValue);
              return Number.isNaN(val) ? params.oldValue : val;
            },
          };
        case "boolean":
          return {
            ...base,
            cellDataType: "boolean",
            cellRenderer: "agCheckboxCellRenderer",
            cellEditor: "agCheckboxCellEditor",
          };
        case "date":
          return {
            ...base,
            cellDataType: "text",
            valueFormatter: (params: { value: string }) => {
              if (!params.value) return "";
              try {
                const d = new Date(params.value);
                return d.toISOString().slice(0, 10);
              } catch {
                return String(params.value);
              }
            },
          };
        default:
          return { ...base, cellDataType: "text" };
      }
    });

    return cols;
  }, [activeTable, tableColumns]);

  // ── AG Grid Row Data ──
  // Resolve column name keys → column ID keys for backward compatibility
  // (data inserted via MCP/API using column names instead of IDs)
  const agRowData = useMemo(() => {
    const nameToId = new Map<string, string>();
    for (const col of tableColumns) {
      nameToId.set(col.name.toLowerCase(), col.id);
    }

    return rows.map((row) => {
      const resolved: Record<string, unknown> = { __rowId: row.id };
      for (const [key, value] of Object.entries(row.data)) {
        if (key.startsWith("col_")) {
          resolved[key] = value;
        } else {
          // Try to resolve column name → ID
          const colId = nameToId.get(key.toLowerCase());
          if (colId) {
            resolved[colId] = value;
          } else {
            resolved[key] = value;
          }
        }
      }
      return resolved;
    });
  }, [rows, tableColumns]);

  // ── AG Grid cell edit handler ──
  const onCellValueChanged = useCallback(
    async (event: CellValueChangedEvent) => {
      if (!id || !activeTableId) return;
      const rowId = event.data.__rowId as string;
      const colId = event.colDef.field as string;
      const newValue = event.newValue;

      try {
        await client.tables.updateRow(id, activeTableId, rowId, {
          data: { [colId]: newValue },
        });
      } catch {
        message.error("Failed to update cell");
        // Revert
        event.node.setDataValue(colId, event.oldValue);
      }
    },
    [id, activeTableId],
  );

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
  }, []);

  // ── Table / Row / Column actions ──

  const handleDeleteTable = (table: DynamicTable) => {
    confirm({
      title: <span className="font-mono text-[14px]">Delete Table</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `"${table.name}" and all ${table.rowCount} row(s) will be permanently deleted.`,
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.tables.delete(id!, table.id);
          const remaining = tables.filter((t) => t.id !== table.id);
          setTables(remaining);
          if (activeTableId === table.id) {
            setActiveTableId(remaining.length > 0 ? remaining[0].id : null);
          }
          message.success(`Table "${table.name}" deleted`);
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleDeleteColumn = (col: ColumnDef) => {
    if (!id || !activeTableId) return;
    confirm({
      title: <span className="font-mono text-[14px]">Delete Column "{col.name}"</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: "This will remove this column and its data from all rows.",
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.tables.deleteColumn(id!, activeTableId!, col.id);
          await refetchActiveTable();
          await fetchRows();
          message.success("Column deleted");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleDeleteSelectedRows = useCallback(() => {
    if (!id || !activeTableId || !gridApiRef.current) return;
    const selectedNodes = gridApiRef.current.getSelectedNodes();
    const selectedIds = selectedNodes.map((n) => n.data.__rowId as string);
    if (selectedIds.length === 0) return;

    confirm({
      title: <span className="font-mono text-[14px]">Delete {selectedIds.length} Row(s)</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: "This action is irreversible.",
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.tables.bulkDeleteRows(id!, activeTableId!, selectedIds);
          setRows((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
          setPagination((prev) => ({ ...prev, total: prev.total - selectedIds.length }));
          message.success(`${selectedIds.length} row(s) deleted`);
        } catch {
          message.error("Failed to delete rows");
        }
      },
    });
  }, [id, activeTableId]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }
  if (!project) return null;

  // ══════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <button
            className="flex items-center justify-center w-9 h-9 rounded-md bg-canvas hover:bg-surface-card border border-hairline text-muted transition-colors cursor-pointer"
            onClick={() => navigate("/datatables")}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3">
              {project.icon ? <span className="text-2xl">{project.icon}</span> : <Database size={22} className="text-ink" />}
              <h1 className="font-display text-[26px] md:text-[32px] tracking-tight text-ink m-0 leading-tight truncate">{project.name}</h1>
            </div>
            {project.description && <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft mt-1 truncate">{project.description}</span>}
          </div>
          <button
            onClick={() => setDocsOpen(true)}
            className="flex items-center gap-1.5 h-[36px] px-4 rounded-md bg-transparent border border-hairline hover:bg-surface-card text-ink font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer shrink-0"
          >
            <BookOpen size={14} />
            Connect LLM
          </button>
        </div>

        {/* ── Table Tabs ── */}
        <div className="flex items-end gap-0 border-b border-hairline -mx-8 px-8">
          <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-none">
            {tablesLoading ? (
              <div className="px-4 py-2">
                <Spin size="small" />
              </div>
            ) : (
              tables.map((table) => {
                const isActive = table.id === activeTableId;
                return (
                  <div key={table.id} className="relative group flex items-center shrink-0">
                    <button
                      onClick={() => setActiveTableId(table.id)}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-none cursor-pointer transition-colors bg-transparent relative
                        ${
                          isActive
                            ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-ink after:rounded-t-full"
                            : "text-muted hover:text-ink"
                        }
                      `}
                    >
                      {table.icon ? (
                        <span className="text-sm">{table.icon}</span>
                      ) : (
                        <Table2 size={14} strokeWidth={1.5} className={isActive ? "text-ink" : "text-muted-soft"} />
                      )}
                      {table.name}
                    </button>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: "edit",
                            icon: <Pencil size={13} />,
                            label: <span className="font-mono text-[12px]">Configure</span>,
                            onClick: () => setEditTable(table),
                          },
                          { type: "divider" },
                          {
                            key: "delete",
                            icon: <Trash2 size={13} />,
                            label: <span className="font-mono text-[12px]">Delete</span>,
                            danger: true,
                            onClick: () => handleDeleteTable(table),
                          },
                        ],
                      }}
                      trigger={["click"]}
                    >
                      <button
                        className="inline-flex items-center justify-center w-6 h-6 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </Dropdown>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => setCreateTableOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-muted hover:text-ink bg-transparent border-none cursor-pointer transition-colors shrink-0 font-medium"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* ── Inline Table Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!activeTable ? (
          <div className="flex flex-col items-center justify-center flex-1 px-8">
            <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-hairline-strong rounded-md bg-transparent max-w-[600px] w-full py-[60px]">
              <Table2 size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
              <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">NO TABLES FOUND</div>
              <button
                onClick={() => setCreateTableOpen(true)}
                className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
              >
                Initialize Table
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-8 py-2.5 border-b border-hairline-soft bg-canvas shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">
                {pagination.total} RECORD{pagination.total !== 1 ? "S" : ""}
              </span>
              <div className="flex-1" />

              {/* ── Filter Button ── */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 h-[28px] px-2.5 rounded text-[11px] font-mono uppercase tracking-wide bg-transparent border cursor-pointer transition-colors ${
                    filters.length > 0 ? "border-ink text-ink" : "border-transparent text-muted-soft hover:text-ink"
                  }`}
                  onClick={() => {
                    setFilterOpen(!filterOpen);
                    setSortOpen(false);
                  }}
                >
                  <Filter size={12} />
                  FILTER
                  {filters.length > 0 && (
                    <span className="flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-ink text-canvas text-[9px] font-bold px-1">
                      {filters.length}
                    </span>
                  )}
                </button>

                {/* Filter Dropdown */}
                {filterOpen && (
                  <FilterDropdown
                    columns={tableColumns}
                    filters={filters}
                    filterLogic={filterLogic}
                    onFiltersChange={(f) => {
                      setFilters(f);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    onFilterLogicChange={setFilterLogic}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>

              {/* ── Sort Button ── */}
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 h-[28px] px-2.5 rounded text-[11px] font-mono uppercase tracking-wide bg-transparent border cursor-pointer transition-colors ${
                    sortColumn ? "border-ink text-ink" : "border-transparent text-muted-soft hover:text-ink"
                  }`}
                  onClick={() => {
                    setSortOpen(!sortOpen);
                    setFilterOpen(false);
                  }}
                >
                  <ArrowUpDown size={12} />
                  SORT
                  {sortColumn && <span className="text-[9px] font-bold">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                </button>

                {/* Sort Dropdown */}
                {sortOpen && (
                  <SortDropdown
                    columns={tableColumns}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSortChange={(col, dir) => {
                      setSortColumn(col);
                      setSortDirection(dir);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    onClear={() => {
                      setSortColumn("");
                      setSortDirection("asc");
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    onClose={() => setSortOpen(false)}
                  />
                )}
              </div>

              <div className="w-px h-4 bg-hairline" />
              <button
                className="flex items-center gap-1.5 h-[28px] px-2.5 rounded text-muted-soft text-[11px] font-mono uppercase tracking-wide bg-transparent border-none cursor-pointer hover:text-error transition-colors"
                onClick={handleDeleteSelectedRows}
              >
                <Trash2 size={12} />
                DELETE SEL.
              </button>
              <div className="w-px h-4 bg-hairline" />
              <button
                className="flex items-center gap-1.5 h-[28px] px-3 rounded-md bg-surface-card border border-hairline text-ink font-medium text-[12px] hover:border-hairline-strong transition-colors cursor-pointer"
                onClick={() => setAddRowOpen(true)}
              >
                <Plus size={13} />
                Row
              </button>
              <button
                className="flex items-center gap-1.5 h-[28px] px-3 rounded-md bg-ink text-canvas border-none font-medium text-[12px] hover:bg-primary-active transition-colors cursor-pointer"
                onClick={() => setAddColumnOpen(true)}
              >
                <Plus size={13} />
                Column
              </button>
            </div>

            {/* ── AG Grid Spreadsheet ── */}
            <div className="flex-1 overflow-hidden">
              {rowsLoading && rows.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Spin size="large" />
                </div>
              ) : (
                <div className="h-full w-full ag-theme-gomustack">
                  <AgGridReact
                    ref={gridRef}
                    theme={agentHandsTheme}
                    rowData={agRowData}
                    columnDefs={agColDefs}
                    getRowId={(params) => params.data.__rowId}
                    rowSelection="multiple"
                    suppressRowClickSelection
                    onCellValueChanged={onCellValueChanged}
                    onGridReady={onGridReady}
                    animateRows
                    undoRedoCellEditing
                    undoRedoCellEditingLimit={20}
                    stopEditingWhenCellsLoseFocus
                    defaultColDef={{
                      resizable: true,
                      sortable: true,
                      editable: true,
                      minWidth: 120,
                    }}
                    rowHeight={36}
                    headerHeight={34}
                    noRowsOverlayComponent={() => (
                      <div className="flex flex-col items-center gap-3 py-12">
                        <span className="font-mono text-[11px] text-muted-soft uppercase tracking-wide">EMPTY TABLE</span>
                        <button
                          onClick={() => setAddRowOpen(true)}
                          className="font-mono text-[11px] text-ink uppercase tracking-wide bg-transparent border-none cursor-pointer hover:underline p-0"
                        >
                          + INSERT FIRST ROW
                        </button>
                      </div>
                    )}
                    context={{
                      onEditColumn: (col: ColumnDef) => setEditColumn(col),
                      onDeleteColumn: (col: ColumnDef) => handleDeleteColumn(col),
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── Pagination ── */}
            {pagination.total > pagination.limit && (
              <div className="flex justify-between items-center px-8 py-2.5 border-t border-hairline shrink-0 bg-canvas">
                <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
                  {pagination.total} RECORD{pagination.total !== 1 ? "S" : ""}
                </span>
                <div className="flex items-center gap-4">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    className="font-mono text-[11px] uppercase tracking-wide text-ink cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none p-0 hover:underline"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
                    Page {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                  </span>
                  <button
                    disabled={pagination.page * pagination.limit >= pagination.total}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    className="font-mono text-[11px] uppercase tracking-wide text-ink cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border-none p-0 hover:underline"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  MODALS                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <CreateTableInDbModal
        open={createTableOpen}
        projectId={id as string}
        onClose={() => setCreateTableOpen(false)}
        onCreated={(table) => {
          setCreateTableOpen(false);
          setTables((prev) => [...prev, table]);
          setActiveTableId(table.id);
        }}
      />

      <EditTableModal
        table={editTable}
        projectId={id as string}
        onClose={() => setEditTable(null)}
        onUpdated={() => {
          setEditTable(null);
          fetchTables();
        }}
      />

      {activeTable && (
        <>
          <AddRowModal
            open={addRowOpen}
            onClose={() => setAddRowOpen(false)}
            onCreated={(newRow) => {
              setAddRowOpen(false);
              setRows((prev) => [newRow, ...prev]);
              setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
            }}
            tableId={activeTableId!}
            projectId={id as string}
            columns={tableColumns}
          />

          <AddColumnModal
            open={addColumnOpen}
            onClose={() => setAddColumnOpen(false)}
            onCreated={async () => {
              setAddColumnOpen(false);
              await refetchActiveTable();
              await fetchRows();
            }}
            tableId={activeTableId!}
            projectId={id as string}
          />

          <EditColumnModal
            column={editColumn}
            onClose={() => setEditColumn(null)}
            onUpdated={async () => {
              setEditColumn(null);
              await refetchActiveTable();
              await fetchRows();
            }}
            tableId={activeTableId!}
            projectId={id as string}
          />
        </>
      )}

      <DatatableDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} project={project} tables={tables} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════════════════════════════

interface ColumnInput {
  key: string;
  name: string;
  type: ColumnType;
}

function CreateTableInDbModal({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (table: DynamicTable) => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<ColumnInput[]>([{ key: "1", name: "", type: "text" }]);

  const addColumn = () => {
    setColumns((prev) => [...prev, { key: String(Date.now()), name: "", type: "text" }]);
  };

  const removeColumn = (key: string) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((c) => c.key !== key));
  };

  const updateColumn = (key: string, field: "name" | "type", value: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async (values: { name: string; description?: string }) => {
    const emptyCol = columns.find((c) => !c.name.trim());
    if (emptyCol) {
      message.warning("All columns must have a name");
      return;
    }
    setLoading(true);
    try {
      const table = await client.tables.create(projectId, {
        name: values.name,
        description: values.description,
        columns: columns.map((c) => ({ name: c.name.trim(), type: c.type })),
      });
      onCreated(table);
      form.resetFields();
      setColumns([{ key: "1", name: "", type: "text" }]);
      message.success(`Table "${table.name}" created`);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to create table");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Table" open={open} onCancel={onClose} footer={null} destroyOnHidden width={520}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: "Table name is required" }, { max: 255 }]}>
          <Input autoFocus placeholder="e.g. Contacts" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Optional description" showCount maxLength={1000} />
        </Form.Item>

        <div style={{ marginBottom: 20 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted font-semibold">Columns</span>
            <button
              type="button"
              onClick={addColumn}
              className="flex items-center gap-1 bg-transparent border-none text-ink text-[12px] font-medium cursor-pointer hover:underline p-0"
            >
              <Plus size={12} /> Add column
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {columns.map((col, idx) => (
              <div key={col.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                  placeholder={idx === 0 ? "e.g. Title" : "Column name"}
                  value={col.name}
                  onChange={(e) => updateColumn(col.key, "name", e.target.value)}
                  style={{ flex: 1 }}
                />
                <Select value={col.type} onChange={(val) => updateColumn(col.key, "type", val)} options={COLUMN_TYPE_OPTIONS} style={{ width: 130 }} />
                <button
                  type="button"
                  disabled={columns.length <= 1}
                  onClick={() => removeColumn(col.key)}
                  className="flex items-center justify-center w-8 h-8 rounded-md bg-transparent border-none text-muted hover:text-error cursor-pointer disabled:opacity-30 p-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EditTableModal({
  table,
  projectId,
  onClose,
  onUpdated,
}: {
  table: DynamicTable | null;
  projectId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form] = Form.useForm<UpdateTableInput>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (table) form.setFieldsValue({ name: table.name, description: table.description ?? undefined });
  }, [table, form]);

  const handleSubmit = async (values: UpdateTableInput) => {
    if (!table) return;
    setLoading(true);
    try {
      await client.tables.update(projectId, table.id, values);
      onUpdated();
      message.success("Table updated");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to update table");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Edit Table" open={!!table} onCancel={onClose} footer={null} destroyOnHidden width={480}>
      <Form<UpdateTableInput> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: "Table name is required" }, { max: 255 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} showCount maxLength={1000} />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AddRowModal({
  open,
  onClose,
  onCreated,
  tableId,
  projectId,
  columns,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (row: DynamicTableRow) => void;
  tableId: string;
  projectId: string;
  columns: ColumnDef[];
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const values = form.getFieldsValue();
    const data: Record<string, unknown> = {};
    for (const col of columns) {
      const val = values[col.id];
      if (val !== undefined && val !== null && val !== "") {
        data[col.id] = col.type === "date" ? new Date(val).toISOString() : val;
      }
    }
    setLoading(true);
    try {
      const newRow = await client.tables.createRow(projectId, tableId, { data });
      onCreated(newRow);
      form.resetFields();
      message.success("Row added");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to add row");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Row" open={open} onCancel={onClose} footer={null} destroyOnHidden width={480}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        {columns.map((col) => (
          <Form.Item key={col.id} name={col.id} label={col.name}>
            {col.type === "number" ? (
              <InputNumber style={{ width: "100%" }} placeholder={`Enter ${col.name}`} />
            ) : col.type === "boolean" ? (
              <Switch />
            ) : col.type === "date" ? (
              <Input type={col.options?.includeTime ? "datetime-local" : "date"} />
            ) : (
              <Input placeholder={`Enter ${col.name}`} />
            )}
          </Form.Item>
        ))}
        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AddColumnModal({
  open,
  onClose,
  onCreated,
  tableId,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tableId: string;
  projectId: string;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: AddColumnInput) => {
    setLoading(true);
    try {
      await client.tables.addColumn(projectId, tableId, { name: values.name, type: values.type });
      onCreated();
      form.resetFields();
      message.success("Column added");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to add column");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Column" open={open} onCancel={onClose} footer={null} destroyOnHidden width={440}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} initialValues={{ type: "text" }} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Column Name" rules={[{ required: true, message: "Name is required" }]}>
          <Input autoFocus placeholder="e.g. Status" />
        </Form.Item>
        <Form.Item name="type" label="Type">
          <Select>
            {Object.entries(COLUMN_TYPE_CONFIG).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {config.icon} {config.label}
                </span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EditColumnModal({
  column,
  onClose,
  onUpdated,
  tableId,
  projectId,
}: {
  column: ColumnDef | null;
  onClose: () => void;
  onUpdated: () => void;
  tableId: string;
  projectId: string;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (column) form.setFieldsValue({ name: column.name, type: column.type });
  }, [column, form]);

  const handleSubmit = async (values: UpdateColumnInput) => {
    if (!column) return;
    setLoading(true);
    try {
      await client.tables.updateColumn(projectId, tableId, column.id, { name: values.name, type: values.type });
      onUpdated();
      message.success("Column updated");
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to update column");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Edit Column — ${column?.name}`} open={!!column} onCancel={onClose} footer={null} destroyOnHidden width={440}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Column Name" rules={[{ required: true, message: "Name is required" }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="type" label="Type">
          <Select disabled={column?.order === 0}>
            {Object.entries(COLUMN_TYPE_CONFIG).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {config.icon} {config.label}
                </span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  FILTER DROPDOWN
// ══════════════════════════════════════════════════════════════════════════════

// Internal filter type with stable key for React rendering
interface FilterWithKey extends FilterCondition {
  _key: number;
}

function FilterDropdown({
  columns,
  filters,
  filterLogic,
  onFiltersChange,
  onFilterLogicChange,
  onClose,
}: {
  columns: ColumnDef[];
  filters: FilterCondition[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterCondition[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
  onClose: () => void;
}) {
  // Stable key counter for filter rows (avoids using array index as key)
  const nextKeyRef = useRef(0);
  const keyedFiltersRef = useRef<FilterWithKey[]>([]);

  // Sync external filters with internal keyed filters
  // Assign _key to new filters, preserve existing keys
  if (filters.length !== keyedFiltersRef.current.length) {
    if (filters.length > keyedFiltersRef.current.length) {
      // Filters added — assign keys to new ones
      const existing = keyedFiltersRef.current;
      const newOnes = filters.slice(existing.length).map((f) => ({
        ...f,
        _key: nextKeyRef.current++,
      }));
      keyedFiltersRef.current = [...existing, ...newOnes];
    } else {
      // Filters removed — rebuild from current filters using existing keys where possible
      keyedFiltersRef.current = keyedFiltersRef.current.slice(0, filters.length);
    }
  }
  // Keep data in sync
  keyedFiltersRef.current = keyedFiltersRef.current.map((kf, i) => ({
    ...filters[i],
    _key: kf._key,
  }));

  const keyedFilters = keyedFiltersRef.current;

  const addFilter = () => {
    if (columns.length === 0) return;
    const col = columns[0];
    const ops = FILTER_OPERATORS_BY_TYPE[col.type];
    onFiltersChange([...filters, { columnId: col.id, operator: ops[0].value, value: "" }]);
  };

  const updateFilter = (index: number, patch: Partial<FilterCondition>) => {
    const updated = filters.map((f, i) => {
      if (i !== index) return f;
      const merged = { ...f, ...patch };
      // When column changes, reset operator to first valid for new type
      if (patch.columnId && patch.columnId !== f.columnId) {
        const col = columns.find((c) => c.id === patch.columnId);
        if (col) {
          const ops = FILTER_OPERATORS_BY_TYPE[col.type];
          merged.operator = ops[0].value;
          merged.value = "";
        }
      }
      // When operator changes to no-value, clear value
      if (patch.operator && NO_VALUE_OPERATORS.includes(patch.operator)) {
        merged.value = undefined;
      }
      return merged;
    });
    onFiltersChange(updated);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const getColumnType = (columnId: string): ColumnType => {
    return columns.find((c) => c.id === columnId)?.type ?? "text";
  };

  return (
    <div
      className="absolute right-0 top-[34px] z-50 bg-white border border-hairline rounded-lg shadow-lg min-w-[480px] max-w-[600px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted font-semibold">Filters</span>
        <div className="flex items-center gap-2">
          {filters.length > 1 && (
            <div className="flex items-center gap-1 bg-surface-card rounded border border-hairline overflow-hidden">
              <button
                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide border-none cursor-pointer transition-colors ${
                  filterLogic === "and" ? "bg-ink text-canvas" : "bg-transparent text-muted hover:text-ink"
                }`}
                onClick={() => onFilterLogicChange("and")}
              >
                AND
              </button>
              <button
                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide border-none cursor-pointer transition-colors ${
                  filterLogic === "or" ? "bg-ink text-canvas" : "bg-transparent text-muted hover:text-ink"
                }`}
                onClick={() => onFilterLogicChange("or")}
              >
                OR
              </button>
            </div>
          )}
          <button
            className="flex items-center justify-center w-6 h-6 bg-transparent border-none cursor-pointer text-muted hover:text-ink rounded transition-colors p-0"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Filter rows */}
      <div className="px-4 py-2 max-h-[300px] overflow-y-auto">
        {filters.length === 0 ? (
          <div className="text-center py-4">
            <span className="font-mono text-[11px] text-muted-soft uppercase tracking-wide">No filters applied</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {keyedFilters.map((filter, index) => {
              const colType = getColumnType(filter.columnId || "");
              const operators = FILTER_OPERATORS_BY_TYPE[colType] ?? FILTER_OPERATORS_BY_TYPE.text;
              const needsValue = !NO_VALUE_OPERATORS.includes(filter.operator);

              return (
                <div key={filter._key} className="flex items-center gap-2">
                  {/* Logic label */}
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-soft w-[36px] text-right shrink-0">
                    {index === 0 ? "Where" : filterLogic.toUpperCase()}
                  </span>

                  {/* Column select */}
                  <Select
                    size="small"
                    value={filter.columnId}
                    onChange={(val) => updateFilter(index, { columnId: val })}
                    style={{ width: 130 }}
                    popupMatchSelectWidth={false}
                  >
                    {columns.map((col) => (
                      <Select.Option key={col.id} value={col.id}>
                        <span className="flex items-center gap-1.5 text-[12px]">
                          {COLUMN_TYPE_CONFIG[col.type].icon}
                          {col.name}
                        </span>
                      </Select.Option>
                    ))}
                  </Select>

                  {/* Operator select */}
                  <Select
                    size="small"
                    value={filter.operator}
                    onChange={(val) => updateFilter(index, { operator: val as FilterOperator })}
                    style={{ width: 120 }}
                    popupMatchSelectWidth={false}
                  >
                    {operators.map((op) => (
                      <Select.Option key={op.value} value={op.value}>
                        <span className="text-[12px]">{op.label}</span>
                      </Select.Option>
                    ))}
                  </Select>

                  {/* Value input */}
                  {needsValue && (
                    <>
                      {colType === "boolean" ? (
                        <Select
                          size="small"
                          value={filter.value === true || filter.value === "true" ? "true" : "false"}
                          onChange={(val) => updateFilter(index, { value: val === "true" })}
                          style={{ width: 100 }}
                        >
                          <Select.Option value="true">True</Select.Option>
                          <Select.Option value="false">False</Select.Option>
                        </Select>
                      ) : colType === "number" ? (
                        <InputNumber
                          size="small"
                          value={filter.value as number}
                          onChange={(val) => updateFilter(index, { value: val })}
                          style={{ width: 100 }}
                          placeholder="Value"
                        />
                      ) : (
                        <Input
                          size="small"
                          value={String(filter.value ?? "")}
                          onChange={(e) => updateFilter(index, { value: e.target.value })}
                          style={{ flex: 1, minWidth: 80 }}
                          placeholder="Value"
                        />
                      )}
                    </>
                  )}

                  {/* Remove button */}
                  <button
                    className="flex items-center justify-center w-6 h-6 shrink-0 bg-transparent border-none cursor-pointer text-muted-soft hover:text-error rounded transition-colors p-0"
                    onClick={() => removeFilter(index)}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-hairline">
        <button
          className="flex items-center gap-1.5 bg-transparent border-none text-ink text-[12px] font-medium cursor-pointer hover:underline p-0"
          onClick={addFilter}
        >
          <Plus size={12} />
          Add filter
        </button>
        {filters.length > 0 && (
          <button
            className="bg-transparent border-none text-muted text-[11px] font-mono uppercase tracking-wide cursor-pointer hover:text-error p-0 transition-colors"
            onClick={() => onFiltersChange([])}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SORT DROPDOWN
// ══════════════════════════════════════════════════════════════════════════════

function SortDropdown({
  columns,
  sortColumn,
  sortDirection,
  onSortChange,
  onClear,
  onClose,
}: {
  columns: ColumnDef[];
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSortChange: (column: string, direction: "asc" | "desc") => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[34px] z-50 bg-white border border-hairline rounded-lg shadow-lg min-w-[280px]" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted font-semibold">Sort</span>
        <button
          className="flex items-center justify-center w-6 h-6 bg-transparent border-none cursor-pointer text-muted hover:text-ink rounded transition-colors p-0"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Column list */}
      <div className="py-1 max-h-[300px] overflow-y-auto">
        {columns.map((col) => {
          const isActive = sortColumn === col.id;
          return (
            <button
              key={col.id}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left bg-transparent border-none cursor-pointer transition-colors ${
                isActive ? "bg-surface-card text-ink" : "text-muted hover:bg-surface-card hover:text-ink"
              }`}
              onClick={() => {
                if (isActive) {
                  // Toggle direction
                  onSortChange(col.id, sortDirection === "asc" ? "desc" : "asc");
                } else {
                  onSortChange(col.id, "asc");
                }
              }}
            >
              <span className="text-muted-soft">{COLUMN_TYPE_CONFIG[col.type].icon}</span>
              <span className="flex-1 text-[12px] font-medium">{col.name}</span>
              {isActive && <span className="font-mono text-[10px] uppercase tracking-wide text-muted-soft">{sortDirection === "asc" ? "A→Z" : "Z→A"}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {sortColumn && (
        <div className="px-4 py-2.5 border-t border-hairline">
          <button
            className="bg-transparent border-none text-muted text-[11px] font-mono uppercase tracking-wide cursor-pointer hover:text-error p-0 transition-colors"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Clear sort
          </button>
        </div>
      )}
    </div>
  );
}
