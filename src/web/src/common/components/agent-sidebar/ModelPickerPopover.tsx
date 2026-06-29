import { ArrowLeft, Bot, ChevronDown, ChevronRight, CircleCheck, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LlmProviderItem } from "src/lib/types";

// ── Model Picker Popover (drill-down) ─────────────────────────────────────────

export function ModelPickerPopover({
  providers,
  selectedProviderId,
  selectedModel,
  onSelect,
  compact = false,
}: {
  providers: LlmProviderItem[];
  selectedProviderId: string;
  selectedModel: string;
  onSelect: (providerId: string, model: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveProvider(null);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search when entering model list
  useEffect(() => {
    if (activeProvider && searchRef.current) {
      searchRef.current.focus();
    }
  }, [activeProvider]);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const activeProviderData = providers.find((p) => p.id === activeProvider);
  const filteredModels = activeProviderData?.models.filter((m) => m.toLowerCase().includes(search.toLowerCase())) ?? [];

  const handleToggle = () => {
    setOpen(!open);
    if (open) {
      setActiveProvider(null);
      setSearch("");
    }
  };

  const handleSelectProvider = (pid: string) => {
    setActiveProvider(pid);
    setSearch("");
  };

  const handleBack = () => {
    setActiveProvider(null);
    setSearch("");
  };

  const handleSelectModel = (model: string) => {
    if (activeProvider) {
      onSelect(activeProvider, model);
    }
    setOpen(false);
    setActiveProvider(null);
    setSearch("");
  };

  // Display label
  const displayLabel = currentProvider ? `${currentProvider.name} / ${selectedModel || "—"}` : "Select model…";

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className={compact
          ? "flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer text-left min-w-0 border-none bg-transparent hover:bg-canvas-soft group"
          : "w-full flex items-center gap-2 px-3 py-2 rounded-md border border-hairline bg-surface-card hover:border-hairline-strong transition-colors cursor-pointer text-left min-w-0"
        }
      >
        {!compact && <Bot size={14} className="text-muted-soft shrink-0" />}
        <span className={`font-mono text-[12px] truncate ${compact ? "text-muted group-hover:text-ink transition-colors" : "flex-1 min-w-0 text-ink"}`}>{compact ? (selectedModel || "Select model…") : displayLabel}</span>
        <ChevronDown size={compact ? 12 : 14} className={`text-muted-soft shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[260px] bg-surface-card border border-hairline rounded-lg shadow-[0_4px_24px_rgba(20,20,19,0.06)] overflow-hidden">
          {!activeProvider ? (
            /* Panel 1: Provider list */
            <div>
              <div className="px-3 py-2 border-b border-hairline">
                <span className="font-mono text-[10px] uppercase tracking-[0.88px] text-muted-soft font-semibold">SELECT PROVIDER</span>
              </div>
              <div className="max-h-[240px] overflow-y-auto py-1">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer border-none bg-transparent hover:bg-canvas-soft transition-colors ${
                      p.id === selectedProviderId ? "bg-canvas-soft" : ""
                    }`}
                  >
                    <span className="font-mono text-[12px] text-ink truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[11px] text-muted-soft">{p.models.length}</span>
                      <ChevronRight size={12} className="text-muted-soft" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Panel 2: Model list */
            <div>
              {/* Back + search header */}
              <div className="px-2 py-1.5 border-b border-hairline flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-left cursor-pointer border-none bg-transparent hover:text-ink transition-colors text-muted py-0.5"
                >
                  <ArrowLeft size={13} />
                  <span className="font-mono text-[12px] font-medium truncate">{activeProviderData?.name || "Back"}</span>
                </button>
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-soft pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search models…"
                    className="w-full font-mono text-[12px] bg-canvas-soft text-ink pl-7 pr-2 py-1.5 rounded-md border border-hairline outline-none placeholder:text-muted-soft focus:border-hairline-strong transition-colors"
                  />
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto py-1">
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <span className="font-mono text-[11px] uppercase tracking-[0.6px] text-muted-soft">NO MODELS FOUND</span>
                  </div>
                ) : (
                  filteredModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer border-none bg-transparent hover:bg-canvas-soft transition-colors ${
                        m === selectedModel && activeProvider === selectedProviderId ? "bg-canvas-soft" : ""
                      }`}
                    >
                      <span className="font-mono text-[12px] text-ink truncate">{m}</span>
                      {m === selectedModel && activeProvider === selectedProviderId && (
                        <CircleCheck size={13} className="text-semantic-success shrink-0 ml-auto" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
