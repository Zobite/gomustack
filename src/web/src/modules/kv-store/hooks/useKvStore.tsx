import type { CellValueChangedEvent, GridApi, GridReadyEvent } from "ag-grid-community";
import { message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "src/lib/client";
import type { Variable } from "src/lib/types";

/**
 * Core data-management hook for the KV Store page.
 * Handles fetching, search, pagination, inline editing, and grid selection.
 */
export function useKvStore() {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  // Grid
  const gridApiRef = useRef<GridApi | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchVariables = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.kvStore.list({
        search: debouncedSearch || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setVariables(result.items);
      setPagination((prev) => ({ ...prev, total: result.meta.total }));
    } catch {
      message.error("Failed to load variables");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchVariables();
  }, [fetchVariables]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handlePurged = (purgedIds: string[]) => {
    setVariables((prev) => prev.filter((v) => !purgedIds.includes(v.id)));
    setSelectedIds([]);
  };

  const goToPrevPage = () => setPagination((p) => ({ ...p, page: p.page - 1 }));
  const goToNextPage = () => setPagination((p) => ({ ...p, page: p.page + 1 }));

  // ── AG Grid Callbacks ──────────────────────────────────────────────────────

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
  }, []);

  const onSelectionChanged = useCallback(() => {
    if (!gridApiRef.current) return;
    const selectedNodes = gridApiRef.current.getSelectedNodes();
    setSelectedIds(selectedNodes.map((n) => n.data.id));
  }, []);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const { id, type, ttl } = event.data;
    const colId = event.colDef.field;
    if (colId === "value") {
      const newValue = String(event.newValue);
      try {
        await client.kvStore.update(id, {
          value: newValue,
          type,
          ttl: ttl ?? null,
        });
        message.success("Variable updated");
      } catch {
        message.error("Failed to update variable");
        event.node.setDataValue("value", event.oldValue);
      }
    }
  }, []);

  return {
    // Data
    variables,
    loading,
    searchText,
    pagination,
    selectedIds,

    // Actions
    fetchVariables,
    handleSearchChange,
    handlePurged,
    goToPrevPage,
    goToNextPage,

    // Grid callbacks
    onGridReady,
    onSelectionChanged,
    onCellValueChanged,
  };
}
