import { Form, Input, Modal, Select, Spin, Tag, Tooltip, message } from "antd";
import { AlertTriangle, Box, Check, Copy, Cpu, Globe, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { CreateLlmProviderInput, LlmProviderItem, LlmProviderType, UpdateLlmProviderInput } from "src/lib/types";

const { confirm } = Modal;

// ── Provider metadata ────────────────────────────────────────────────────────

const PROVIDER_META: Record<LlmProviderType, { label: string; defaultUrl: string; requiresKey: boolean }> = {
  openai: { label: "OpenAI", defaultUrl: "https://api.openai.com/v1", requiresKey: true },
  openrouter: { label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1", requiresKey: true },
  anthropic: { label: "Anthropic", defaultUrl: "https://api.anthropic.com/v1", requiresKey: true },
  gemini: { label: "Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta", requiresKey: true },
  ollama: { label: "Ollama", defaultUrl: "http://localhost:11434", requiresKey: false },
  custom: { label: "Custom", defaultUrl: "", requiresKey: true },
};

const PROVIDER_OPTIONS = Object.entries(PROVIDER_META).map(([value, meta]) => ({
  value: value as LlmProviderType,
  label: meta.label,
}));

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LlmProvidersPage() {
  const [providers, setProviders] = useState<LlmProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProviderItem | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [viewModelsProvider, setViewModelsProvider] = useState<LlmProviderItem | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setProviders(await client.llmProviders.list());
      } catch {
        message.error("Failed to load LLM providers");
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const handleDelete = (provider: LlmProviderItem) => {
    confirm({
      title: <span className="font-mono text-[14px]">Remove Provider</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `Remove "${provider.name}"? This will permanently delete the provider and its cached model list.`,
      okText: "Remove",
      okType: "danger",
      cancelText: "Cancel",
      async onOk() {
        try {
          await client.llmProviders.delete(provider.id);
          setProviders((prev) => prev.filter((p) => p.id !== provider.id));
          message.success("Provider removed");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleRefresh = async (provider: LlmProviderItem) => {
    setRefreshingId(provider.id);
    try {
      const updated = await client.llmProviders.refreshModels(provider.id);
      setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      message.success(`Refreshed ${updated.models.length} models`);
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to refresh models");
      }
    } finally {
      setRefreshingId(null);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toISOString().split("T")[0];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Administration / LLM Providers</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">LLM Providers</h1>
            <p className="text-[13px] text-muted mt-2 m-0 leading-relaxed max-w-[520px]">
              Configure large language model providers. Each provider stores an API key and a cached list of available models fetched at creation time.
            </p>
          </div>
          <button
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none shrink-0"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} />
            Add Provider
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px] flex-1">
            <Spin size="large" />
          </div>
        ) : providers.length === 0 ? (
          /* ── Empty State ─────────────────────────────── */
          <div className="flex flex-col items-center justify-center min-h-[300px] flex-1 border border-dashed border-hairline-strong rounded-md bg-transparent m-auto max-w-[600px]">
            <Cpu size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
            <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">NO PROVIDERS CONFIGURED</div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
            >
              Add First Provider
            </button>
          </div>
        ) : (
          /* ── Provider Cards ─────────────────────────── */
          <div className="flex flex-col gap-3">
            {providers.map((provider, idx) => (
              <div
                key={provider.id}
                className="flex items-center gap-5 px-5 py-4 border border-hairline rounded-md bg-surface-card transition-colors duration-150 hover:border-hairline-strong group animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Icon + Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md border border-hairline-soft bg-canvas text-muted shrink-0">
                    <Cpu size={16} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-ink tracking-tight truncate">{provider.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Tag
                        bordered={false}
                        className="!text-[10px] !font-mono !uppercase !tracking-wider !m-0 !px-1.5 !py-0 !rounded-sm"
                        style={{ background: "var(--color-surface-strong)", color: "var(--color-ink)" }}
                      >
                        {PROVIDER_META[provider.providerType]?.label ?? provider.providerType}
                      </Tag>
                    </div>
                  </div>
                </div>

                {/* Key */}
                <div className="w-[140px] shrink-0 hidden lg:block">
                  <div className="font-mono text-[10px] text-muted-soft uppercase tracking-wider mb-0.5">API Key</div>
                  <span className="font-mono text-[12px] text-muted tracking-wide">{provider.apiKey || "—"}</span>
                </div>

                {/* Base URL */}
                <div className="w-[160px] shrink-0 hidden xl:block">
                  <div className="font-mono text-[10px] text-muted-soft uppercase tracking-wider mb-0.5">Base URL</div>
                  <Tooltip title={provider.baseUrl || PROVIDER_META[provider.providerType]?.defaultUrl || "—"}>
                    <span className="font-mono text-[11px] text-muted-soft tracking-wide flex items-center gap-1 truncate">
                      <Globe size={10} className="shrink-0" />
                      {provider.baseUrl ? "Custom" : "Default"}
                    </span>
                  </Tooltip>
                </div>

                {/* Models Count — clickable */}
                <div className="w-[80px] shrink-0">
                  <div className="font-mono text-[10px] text-muted-soft uppercase tracking-wider mb-0.5">Models</div>
                  <button
                    onClick={() => setViewModelsProvider(provider)}
                    className="flex items-center gap-1 font-mono text-[12px] text-ink bg-transparent border-none p-0 cursor-pointer hover:underline underline-offset-2 transition-all"
                    title="View models"
                  >
                    <Box size={11} className="text-muted" />
                    {provider.models.length}
                  </button>
                </div>

                {/* Created */}
                <div className="w-[90px] shrink-0 hidden md:block">
                  <div className="font-mono text-[10px] text-muted-soft uppercase tracking-wider mb-0.5">Created</div>
                  <span className="font-mono text-[11px] text-muted-soft tracking-wide">{formatDate(provider.createdAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                  <Tooltip title="Edit">
                    <button
                      onClick={() => setEditingProvider(provider)}
                      className="inline-flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 transition-all duration-100 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip title="Refresh Models">
                    <button
                      onClick={() => handleRefresh(provider)}
                      disabled={refreshingId === provider.id}
                      className="inline-flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 transition-all duration-100 hover:text-ink disabled:opacity-40"
                    >
                      <RefreshCw size={14} className={refreshingId === provider.id ? "animate-spin" : ""} />
                    </button>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <button
                      onClick={() => handleDelete(provider)}
                      className="inline-flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 transition-all duration-100 hover:text-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && providers.length > 0 && (
          <div className="flex justify-between items-center pt-6">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
              {providers.length} PROVIDER{providers.length !== 1 ? "S" : ""} CONFIGURED
            </span>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <ProviderFormModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSaved={(saved) => {
          setProviders((prev) => [...prev, saved]);
          setCreateModalOpen(false);
        }}
      />

      {/* Edit Modal */}
      <ProviderFormModal
        open={!!editingProvider}
        provider={editingProvider ?? undefined}
        onClose={() => setEditingProvider(null)}
        onSaved={(saved) => {
          setProviders((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
          setEditingProvider(null);
        }}
      />

      {/* Models View Modal */}
      <ModelsViewModal open={!!viewModelsProvider} provider={viewModelsProvider ?? undefined} onClose={() => setViewModelsProvider(null)} />
    </div>
  );
}

// ── Provider Form Modal (Create + Edit) ──────────────────────────────────────

interface FormValues {
  name: string;
  providerType: LlmProviderType;
  apiKey: string;
  baseUrl: string;
}

function ProviderFormModal({
  open,
  provider,
  onClose,
  onSaved,
}: {
  open: boolean;
  provider?: LlmProviderItem;
  onClose: () => void;
  onSaved: (saved: LlmProviderItem) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<LlmProviderType>("openai");

  const isEdit = !!provider;

  useEffect(() => {
    if (open && provider) {
      form.setFieldsValue({
        name: provider.name,
        providerType: provider.providerType,
        apiKey: "", // don't prefill masked key
        baseUrl: provider.baseUrl ?? "",
      });
      setSelectedType(provider.providerType);
    } else if (open) {
      form.resetFields();
      setSelectedType("openai");
    }
  }, [open, provider, form]);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      let saved: LlmProviderItem;
      if (isEdit) {
        const input: UpdateLlmProviderInput = { name: values.name };
        if (values.apiKey) input.apiKey = values.apiKey;
        if (values.baseUrl !== undefined) input.baseUrl = values.baseUrl || null;
        saved = await client.llmProviders.update(provider!.id, input);
      } else {
        const input: CreateLlmProviderInput = {
          name: values.name,
          providerType: values.providerType,
          apiKey: values.apiKey || "",
          baseUrl: values.baseUrl || undefined,
        };
        saved = await client.llmProviders.create(input);
      }
      onSaved(saved);
      form.resetFields();
      message.success(isEdit ? "Provider updated" : `Provider created with ${saved.models.length} models`);
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error(isEdit ? "Failed to update provider" : "Failed to create provider");
      }
    } finally {
      setLoading(false);
    }
  };

  const meta = PROVIDER_META[selectedType];

  return (
    <Modal
      title={<span className="font-mono text-[14px]">{isEdit ? "Edit Provider" : "Add LLM Provider"}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={480}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        style={{ marginTop: 16 }}
        initialValues={{ providerType: "openai", apiKey: "", baseUrl: "" }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, message: "Provider name is required" }]}>
          <Input autoFocus placeholder="e.g. My OpenAI, Production Router" />
        </Form.Item>

        {!isEdit && (
          <Form.Item name="providerType" label="Provider" rules={[{ required: true, message: "Select a provider type" }]}>
            <Select options={PROVIDER_OPTIONS} onChange={(v: LlmProviderType) => setSelectedType(v)} placeholder="Select provider" />
          </Form.Item>
        )}

        {(meta?.requiresKey || isEdit) && (
          <Form.Item
            name="apiKey"
            label={isEdit ? "API Key (leave blank to keep current)" : "API Key"}
            rules={isEdit ? [] : [{ required: meta?.requiresKey, message: "API key is required" }]}
          >
            <Input.Password placeholder={isEdit ? "Enter new key to update" : "sk-..."} style={{ fontFamily: "var(--font-mono)" }} />
          </Form.Item>
        )}

        <Form.Item name="baseUrl" label="Base URL" tooltip="Leave blank to use the provider's default endpoint">
          <Input placeholder={meta?.defaultUrl || "https://..."} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
        </Form.Item>

        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 border border-dashed border-hairline rounded-md bg-canvas-soft">
            <Spin size="small" />
            <span className="font-mono text-[12px] text-muted">Connecting to provider & fetching models...</span>
          </div>
        )}

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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity disabled:opacity-50"
            >
              {loading ? "Connecting..." : isEdit ? "Update" : "Add Provider"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Models View Modal ────────────────────────────────────────────────────────

function ModelsViewModal({
  open,
  provider,
  onClose,
}: {
  open: boolean;
  provider?: LlmProviderItem;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const models = provider?.models ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [models, search]);

  const handleCopy = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
    setCopiedId(modelId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Reset search when modal opens/closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Box size={16} className="text-muted" />
          <span className="font-mono text-[14px]">
            {provider?.name ?? "Models"} — {models.length} model{models.length !== 1 ? "s" : ""}
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={560}
    >
      {/* Search */}
      <div className="relative mt-3 mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="w-full h-[36px] pl-9 pr-3 bg-canvas border border-hairline rounded-md text-[13px] text-ink font-mono placeholder:text-muted-soft focus:outline-none focus:border-hairline-strong transition-colors"
        />
      </div>

      {/* Count + info */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">
          {filtered.length === models.length ? `${models.length} models` : `${filtered.length} / ${models.length} models`}
        </span>
        <span className="font-mono text-[10px] text-muted-soft">Click ID to copy</span>
      </div>

      {/* Model list */}
      <div className="border border-hairline rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-soft font-mono text-[12px]">
            {search ? "No models match your search" : "No models available"}
          </div>
        ) : (
          filtered.map((model, idx) => (
            <div
              key={model}
              className={`flex items-center px-3 py-1.5 ${
                idx !== 0 ? "border-t border-hairline-soft" : ""
              } hover:bg-canvas transition-colors group/row cursor-pointer`}
              onClick={() => handleCopy(model)}
              title={`Copy: ${model}`}
            >
              <span className="font-mono text-[12px] text-ink truncate flex-1">{model}</span>
              {copiedId === model ? (
                <Check size={12} className="text-success shrink-0 ml-2" />
              ) : (
                <Copy size={12} className="text-muted-soft opacity-0 group-hover/row:opacity-100 shrink-0 ml-2 transition-opacity" />
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
