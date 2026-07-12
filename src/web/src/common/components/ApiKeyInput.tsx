import { KeyRound, X } from "lucide-react";
import { useApiKey } from "src/common/hooks/useApiKey";

export default function ApiKeyInput() {
  const [apiKey, setApiKey] = useApiKey();

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-canvas-soft p-4 rounded-lg border border-hairline shrink-0">
      <div className="flex flex-col gap-0.5 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink font-semibold uppercase tracking-wider">
          <KeyRound size={13} className="text-muted" />
          <span>Autofill API Key</span>
        </div>
        <span className="text-[11px] text-muted leading-none mt-0.5">Stored locally in browser</span>
      </div>
      <div className="flex-1 flex items-center relative sm:max-w-[320px] sm:ml-auto">
        <input
          type="password"
          placeholder="Paste API key to inject"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full h-[32px] pl-3 pr-8 bg-surface-card border border-hairline rounded-md text-[12px] text-ink font-mono placeholder:text-muted-soft focus:outline-none focus:border-hairline-strong transition-colors"
        />
        {apiKey && (
          <button
            onClick={() => setApiKey("")}
            className="absolute right-2 px-1 text-muted hover:text-ink cursor-pointer border-none bg-transparent flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
