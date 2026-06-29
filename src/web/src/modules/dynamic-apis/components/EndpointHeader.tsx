import { Input, Select, Switch, Tooltip } from "antd";
import { ArrowLeft, Globe, Lock, Save, Timer, Trash2 } from "lucide-react";
import type { DynamicApiItem } from "src/lib/types";

const METHOD_COLORS: Record<string, string> = {
  GET: "#1f8a65",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#8b5cf6",
  DELETE: "#cf2d56",
};

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
  label: m,
  value: m,
}));

interface EndpointHeaderProps {
  baseUrl: string;
  dirty: boolean;
  saving: boolean;
  isActive: boolean;
  name: string;
  method: DynamicApiItem["method"];
  path: string;
  isPublic: boolean;
  timeout: number;
  onBack: () => void;
  onDelete: () => void;
  onSave: () => void;
  onActiveChange: (active: boolean) => void;
  onNameChange: (value: string) => void;
  onMethodChange: (value: DynamicApiItem["method"]) => void;
  onPathChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onTimeoutChange: (value: number) => void;
}

export function EndpointHeader({
  baseUrl,
  dirty,
  saving,
  isActive,
  name,
  method,
  path,
  isPublic,
  timeout,
  onBack,
  onDelete,
  onSave,
  onActiveChange,
  onNameChange,
  onMethodChange,
  onPathChange,
  onPublicChange,
  onTimeoutChange,
}: EndpointHeaderProps) {
  const methodColor = METHOD_COLORS[method] || "#888";

  return (
    <div className="px-5 pt-5 pb-4 shrink-0 border-b border-hairline">
      {/* Row 1: Back + Name (inline editable) + Active toggle + Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-transparent border border-hairline text-muted hover:text-ink hover:border-hairline-strong transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Endpoint name" className="endpoint-name-input" />
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Switch size="small" checked={isActive} onChange={(checked) => onActiveChange(checked)} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: isActive ? "#1f8a65" : "#999" }}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center w-[32px] h-[32px] rounded-md bg-transparent border border-hairline text-muted hover:text-error hover:border-error/20 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 h-[32px] px-4 rounded-md bg-ink text-canvas text-[13px] font-medium hover:bg-primary-active transition-colors cursor-pointer border-none disabled:opacity-40 disabled:cursor-default"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* URL bar — [Method ▼] [baseUrl/apis][/path] | [Auth] [Timeout] */}
      <div className="flex items-center rounded-md border border-hairline bg-surface-card overflow-hidden">
        <Select
          value={method}
          onChange={(v) => onMethodChange(v)}
          size="medium"
          options={METHOD_OPTIONS}
          variant="borderless"
          className="shrink-0"
          style={{ width: 100 }}
          popupMatchSelectWidth={100}
          labelRender={({ value }) => (
            <span className="font-mono text-[12px] font-semibold" style={{ color: METHOD_COLORS[value as string] || "#888" }}>
              {value}
            </span>
          )}
          optionRender={(option) => (
            <span className="font-mono text-[12px] font-semibold" style={{ color: METHOD_COLORS[option.value as string] || "#888" }}>
              {option.value}
            </span>
          )}
        />
        <div className="w-px h-6 bg-hairline shrink-0" />
        <span className="font-mono text-[12px] text-muted-soft pl-3 shrink-0 select-none">{baseUrl}/apis</span>
        <Input
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          size="small"
          variant="borderless"
          className="font-mono flex-1"
          placeholder="/your-path"
          style={{ color: methodColor }}
        />
        <div className="w-px h-6 bg-hairline shrink-0" />
        <div className="flex items-center gap-2 px-3 shrink-0">
          <Tooltip title={isPublic ? "Anyone can access — no token needed. Click to require auth." : "Requires Bearer token. Click to make public."}>
            <button
              type="button"
              onClick={() => onPublicChange(!isPublic)}
              className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full font-mono text-[10px] border cursor-pointer transition-colors"
              style={{
                backgroundColor: isPublic ? "#fef3c7" : "#f0fdf4",
                borderColor: isPublic ? "#f59e0b33" : "#1f8a6533",
                color: isPublic ? "#92400e" : "#166534",
              }}
            >
              {isPublic ? <Globe size={10} /> : <Lock size={10} />}
              {isPublic ? "Public" : "Auth"}
            </button>
          </Tooltip>
          <Tooltip title={`Max execution time: ${timeout}ms (${(timeout / 1000).toFixed(1)}s)`}>
            <div className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border border-hairline bg-canvas-soft">
              <Timer size={10} className="text-muted-soft" />
              <input
                type="number"
                value={timeout}
                onChange={(e) => onTimeoutChange(Number(e.target.value))}
                className="endpoint-name-input w-[40px] !text-[10px] !font-mono !p-0 !border-none !bg-transparent !rounded-none"
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
              <span className="font-mono text-[9px] text-muted-soft">ms</span>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
