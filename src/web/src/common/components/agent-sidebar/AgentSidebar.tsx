import "streamdown/styles.css";
import { ArrowRight, Bot, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "src/lib/client";
import type { LlmProviderItem } from "src/lib/types";
import { ChainOfThought } from "./ChainOfThought";
import { ModelPickerPopover } from "./ModelPickerPopover";
import { useAutoResize, useElapsedTimer } from "./hooks";
import type { AgentEvent, AgentSidebarProps, ChatMessage } from "./types";
import { stripThinkTags } from "./timeline";

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentSidebar({ adapter, currentCode, onRun, onHooks, callbacks }: AgentSidebarProps) {
  const [providers, setProviders] = useState<LlmProviderItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const [prompt, setPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentEvents, setCurrentEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestCodeRef = useRef(currentCode);
  const textareaRef = useAutoResize(prompt);
  const elapsedStr = useElapsedTimer(running);

  useEffect(() => {
    latestCodeRef.current = currentCode;
  }, [currentCode]);

  // ── Load providers + saved model config ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [items, savedConfig] = await Promise.all([client.llmProviders.list(), client.configurations.get("CODING_AGENT_LLM_MODEL")]);
        if (cancelled) return;
        setProviders(items);

        if (savedConfig?.value && items.length > 0) {
          const [savedProviderId, savedModel] = savedConfig.value.split(":");
          const savedProvider = items.find((p) => p.id === savedProviderId);
          if (savedProvider && savedModel && savedProvider.models.includes(savedModel)) {
            setSelectedProviderId(savedProviderId);
            setSelectedModel(savedModel);
            return;
          }
        }
        if (items.length > 0) {
          setSelectedProviderId(items[0].id);
          if (items[0].models.length > 0) setSelectedModel(items[0].models[0]);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: running ? "instant" : "smooth" });
  }, [chatMessages, currentEvents, running]);

  const saveModelConfig = (providerId: string, model: string) => {
    if (providerId && model) {
      client.configurations.set("CODING_AGENT_LLM_MODEL", `${providerId}:${model}`).catch(() => {});
    }
  };

  // ── Build history for multi-turn ──────────────────────────────────────────

  const buildHistory = useCallback(
    (): Array<{ role: "user" | "assistant"; content: string }> =>
      chatMessages.map((msg) => {
        if (msg.role === "assistant") {
          let content = "";

          // Summarize tool actions so model understands what happened
          if (msg.events && msg.events.length > 0) {
            const actions: string[] = [];
            for (const ev of msg.events) {
              if (ev.type !== "tool_call" || !ev.toolName) continue;
              actions.push(`- Called ${ev.toolName}`);
            }
            if (actions.length > 0) {
              content += `Actions performed:\n${actions.join("\n")}\n\n`;
            }
          }

          if (msg.content) content += msg.content;
          if (msg.code) content += `\n\n\`\`\`javascript\n${msg.code}\n\`\`\``;
          if (msg.cancelled) content += "\n\n(Cancelled by user)";

          return { role: msg.role, content: content || "Done." };
        }
        return { role: msg.role, content: msg.content };
      }),
    [chatMessages],
  );

  // ── Run agent ─────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || !selectedProviderId || !selectedModel || running) return;

    const userPrompt = prompt.trim();
    setPrompt("");
    setChatMessages((prev) => [...prev, { role: "user", content: userPrompt }]);
    setRunning(true);
    setCurrentEvents([]);

    callbacks?.onStart?.();

    const controller = new AbortController();
    abortRef.current = controller;

    const collectedEvents: AgentEvent[] = [];
    let finalCode: string | null = null;
    let assistantText = "";

    try {
      const history = buildHistory();

      const res = await onRun({
        providerId: selectedProviderId,
        model: selectedModel,
        prompt: userPrompt,
        currentCode: latestCodeRef.current,
        history,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: "Request failed" }));
        const errEvent: AgentEvent = {
          type: "error",
          message: (errBody as { message?: string }).message || `HTTP ${res.status}`,
          receivedAt: Date.now(),
        };
        collectedEvents.push(errEvent);
        setCurrentEvents((prev) => [...prev, errEvent]);
        setChatMessages((prev) => [...prev, { role: "assistant", content: errEvent.message || "Error", events: [errEvent] }]);
        callbacks?.onComplete?.({ error: errEvent.message });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "stream_end") continue;
            const event: AgentEvent = { ...parsed, receivedAt: Date.now() };

            collectedEvents.push(event);
            setCurrentEvents((prev) => [...prev, event]);
            callbacks?.onEvent?.(event);

            // Fire onHooks for tool events
            if (event.type === "tool_call" && event.toolName) {
              onHooks?.({ phase: "call", toolName: event.toolName, args: event.toolArgs });
            }
            if (event.type === "tool_result" && event.toolName) {
              onHooks?.({ phase: "result", toolName: event.toolName, result: event.toolResult });
            }
            if (event.code) {
              finalCode = event.code;
              latestCodeRef.current = finalCode;
              onHooks?.({ phase: "code", toolName: "write_code", code: finalCode });
              callbacks?.onCodeGenerated?.(finalCode);
            }
            if (event.type === "text_delta" && event.message) {
              assistantText += event.message;
            } else if (event.type === "text" && event.message) {
              assistantText += (assistantText ? "\n" : "") + event.message;
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: stripThinkTags(assistantText) || "Cancelled by user.",
            events: collectedEvents,
            code: finalCode || undefined,
            cancelled: true,
          },
        ]);
        setRunning(false);
        setCurrentEvents([]);
        abortRef.current = null;
        callbacks?.onComplete?.({ code: finalCode || undefined, cancelled: true });
        return;
      }
      const errEvent: AgentEvent = {
        type: "error",
        message: (err as Error).message,
        receivedAt: Date.now(),
      };
      collectedEvents.push(errEvent);
      setCurrentEvents((prev) => [...prev, errEvent]);
    } finally {
      setRunning(false);
      abortRef.current = null;

      if (finalCode) {
        latestCodeRef.current = finalCode;
        onHooks?.({ phase: "code", toolName: "write_code", code: finalCode, isFinal: true });
      }

      const content = stripThinkTags(assistantText) || (finalCode ? "Code generated successfully." : "Done.");
      setChatMessages((prev) => [...prev, { role: "assistant", content, events: collectedEvents, code: finalCode || undefined }]);
      setCurrentEvents([]);
      callbacks?.onComplete?.({ code: finalCode || undefined });
    }
  }, [prompt, selectedProviderId, selectedModel, running, buildHistory, onRun, onHooks, callbacks]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  // ── No providers configured ───────────────────────────────────────────────

  if (!loadingProviders && providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-16 h-16 rounded-lg border border-dashed border-hairline-strong flex items-center justify-center mb-5">
          <Bot size={28} className="text-muted-soft" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.88px] text-muted-soft mb-2">NO LLM PROVIDER CONFIGURED</span>
        <p className="text-[13px] text-muted leading-relaxed mb-5 max-w-[280px]">Configure at least one LLM provider to enable the AI coding assistant.</p>
        <a
          href="/ui/llm-providers"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-ink text-canvas text-[13px] font-medium hover:opacity-90 transition-opacity no-underline"
        >
          Initialize Provider
          <ChevronRight size={15} />
        </a>
      </div>
    );
  }

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center h-full gap-2.5">
        <Loader2 size={18} className="text-muted-soft animate-spin" />
        <span className="font-mono text-[11px] text-muted-soft uppercase tracking-wide">Loading…</span>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <div className="shrink-0 px-2 py-1.5 border-b border-hairline">
        <div className="flex items-center gap-2">
          {running && (
            <span className="relative flex h-[7px] w-[7px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-amber-500" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <ModelPickerPopover
              providers={providers}
              selectedProviderId={selectedProviderId}
              selectedModel={selectedModel}
              onSelect={(pid, model) => {
                setSelectedProviderId(pid);
                setSelectedModel(model);
                saveModelConfig(pid, model);
              }}
              compact
            />
          </div>
          {running && <span className="font-mono text-[11px] text-amber-400/80 tabular-nums shrink-0">{elapsedStr}</span>}
        </div>
      </div>

      {/* Indeterminate progress bar */}
      <div className="shrink-0 h-[2px] bg-hairline overflow-hidden">
        {running && (
          <div
            className="h-full w-1/3 rounded-full bg-amber-400"
            style={{
              animation: "ai-progress-slide 1.4s ease-in-out infinite",
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes ai-progress-slide {
          0%   { transform: translateX(-100%) scaleX(1); }
          50%  { transform: translateX(150%) scaleX(1.5); }
          100% { transform: translateX(400%) scaleX(1); }
        }
      `}</style>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-4">
        {chatMessages.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-lg border border-dashed border-hairline-strong flex items-center justify-center mb-4">
              <Sparkles size={22} strokeWidth={1.5} className="text-muted-soft" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.88px] text-muted-soft font-semibold">DESCRIBE WHAT TO BUILD</span>
            <span className="text-[12px] text-muted mt-2 max-w-[240px] leading-relaxed">Agent will use tools to code, test, and fix autonomously</span>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div key={`msg-${msg.role}-${msg.content.slice(0, 20)}-${i}`} className="min-w-0">
            {msg.role === "user" ? (
              <div className="flex-1 min-w-0">
                <div
                  className="font-mono text-[12px] text-ink leading-[1.6] bg-surface-card border border-hairline rounded-lg px-3.5 py-2.5 whitespace-pre-wrap"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="pl-1 min-w-0">
                {msg.events && msg.events.length > 0 ? (
                  <ChainOfThought events={msg.events} isLive={false} defaultOpen={false} adapter={adapter} />
                ) : (
                  <div className="font-mono text-[12px] text-body leading-[1.6] whitespace-pre-wrap break-all">{msg.content}</div>
                )}
              </div>
            )}
          </div>
        ))}

        {running && (
          <div className="pl-1">
            <ChainOfThought events={currentEvents} isLive={true} defaultOpen={true} adapter={adapter} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 py-2 bg-canvas">
        <div
          className={`relative flex items-stretch bg-surface-card border rounded-lg focus-within:border-hairline-strong transition-colors overflow-hidden ${running ? "border-amber-500/30" : "border-hairline"}`}
        >
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRun();
              }
            }}
            placeholder={running ? "" : chatMessages.length > 0 ? "Follow up…" : "Describe what to build…"}
            className="w-full font-mono text-[12px] leading-[1.5] bg-transparent text-ink pl-3.5 pr-12 py-3.5 resize-none border-none outline-none focus:outline-none focus:ring-0 placeholder:text-muted-soft"
            rows={2}
            spellCheck={false}
            disabled={running}
            style={{ minHeight: "52px", maxHeight: "120px" }}
          />
          <div className="absolute right-2 bottom-2 z-10 flex items-center">
            {running ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-md bg-semantic-error text-on-primary cursor-pointer border-none hover:opacity-90 transition-opacity"
                title="Abort"
              >
                <X size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRun}
                disabled={!prompt.trim() || !selectedModel}
                className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-md bg-ink text-canvas cursor-pointer border-none hover:opacity-90 transition-opacity disabled:opacity-20"
                title="Execute (Enter)"
              >
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
