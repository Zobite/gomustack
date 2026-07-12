import { Form, Input, Modal, Spin, Tooltip, message } from "antd";
import { AlertTriangle, CheckCircle2, Clock, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { ApiKeyCreated, ApiKeyItem, CreateApiKeyInput } from "src/lib/types";

const { confirm } = Modal;

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        setKeys(await client.apiKeys.list());
      } catch {
        message.error("Failed to load API keys");
      } finally {
        setLoading(false);
      }
    };
    fetchKeys();
  }, []);

  const handleDelete = (key: ApiKeyItem) => {
    confirm({
      title: <span className="font-mono text-[14px]">Revoke Credential</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `Target: ${key.name}. Any applications using this key will lose access. This action is irreversible.`,
      okText: "Execute Revoke",
      okType: "danger",
      cancelText: "Cancel",
      async onOk() {
        try {
          await client.apiKeys.delete(key.id);
          setKeys((prev) => prev.filter((k) => k.id !== key.id));
          message.success("API key revoked");
        } catch (err) {
          if (err instanceof GomuStackError) {
            message.error(err.message);
          }
        }
      },
    });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toISOString().split("T")[0];
  };

  const isExpired = (key: ApiKeyItem) => key.expiresAt !== null && key.expiresAt < Date.now();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Access Control / API Keys</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">API Credentials</h1>
            <p className="text-[13px] text-muted mt-2 m-0 leading-relaxed max-w-[520px]">
              Manage programmatic access to the platform. Authenticate via{" "}
              <code className="font-mono text-[12px] bg-canvas-soft text-ink px-1.5 py-0.5 rounded-sm border border-hairline-soft">
                Authorization: Bearer &lt;API_KEY&gt;
              </code>{" "}
              or <code className="font-mono text-[12px] bg-canvas-soft text-ink px-1.5 py-0.5 rounded-sm border border-hairline-soft">X-API-Key: &lt;API_KEY&gt;</code>
            </p>
          </div>
          <button
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none shrink-0"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} />
            Generate Key
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px] flex-1">
            <Spin size="large" />
          </div>
        ) : keys.length === 0 ? (
          /* ── Empty State ─────────────────────────────── */
          <div className="flex flex-col items-center justify-center min-h-[300px] flex-1 border border-dashed border-hairline-strong rounded-md bg-transparent m-auto max-w-[600px]">
            <KeyRound size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
            <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">NO CREDENTIALS FOUND</div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
            >
              Generate First Key
            </button>
          </div>
        ) : (
          /* ── Key List ─────────────────────────────────── */
          <div className="flex flex-col gap-3">
            {/* Table-like header */}
            <div className="grid grid-cols-[1fr_80px_100px_100px_100px_40px] gap-4 px-5 py-2">
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Identifier</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Status</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Last Used</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Expires</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Created</span>
              <span />
            </div>

            {keys.map((key, idx) => (
              <div
                key={key.id}
                className="grid grid-cols-[1fr_80px_100px_100px_100px_40px] gap-4 items-center px-5 py-3.5 border border-hairline rounded-md bg-surface-card transition-colors duration-150 hover:border-hairline-strong group opacity-0 animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md border border-hairline-soft bg-canvas text-muted shrink-0">
                    <KeyRound size={14} strokeWidth={1.5} />
                  </div>
                  <span className="text-[14px] font-medium text-ink tracking-tight truncate">{key.name}</span>
                </div>

                {/* Status */}
                {isExpired(key) ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-error)" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--color-error)" }} />
                    Expired
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                    Active
                  </span>
                )}

                {/* Last Used */}
                <span className="font-mono text-[11px] text-muted-soft tracking-wide">
                  {key.lastUsedAt ? (
                    <Tooltip title={new Date(key.lastUsedAt).toLocaleString()}>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-muted-soft" />
                        {formatDate(key.lastUsedAt)}
                      </span>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </span>

                {/* Expires */}
                <span className="font-mono text-[11px] text-muted-soft tracking-wide">{key.expiresAt ? formatDate(key.expiresAt) : "NEVER"}</span>

                {/* Created */}
                <span className="font-mono text-[11px] text-muted-soft tracking-wide">{formatDate(key.createdAt)}</span>

                {/* Action */}
                <button
                  onClick={() => handleDelete(key)}
                  className="inline-flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 transition-all duration-100 opacity-0 group-hover:opacity-100 hover:text-error"
                  title="Revoke"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && keys.length > 0 && (
          <div className="flex justify-between items-center pt-6">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
              {keys.length} CREDENTIAL{keys.length !== 1 ? "S" : ""} REGISTERED
            </span>
          </div>
        )}
      </div>

      <CreateKeyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(created) => {
          setCreatedKey(created);
          setKeys((prev) => [...prev, created]);
          setCreateModalOpen(false);
        }}
      />

      <KeyCreatedModal created={createdKey} onClose={() => setCreatedKey(null)} />
    </div>
  );
}

// ── Create Key Modal ─────────────────────────────────────────────────────────

function CreateKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: ApiKeyCreated) => void;
}) {
  const [form] = Form.useForm<CreateApiKeyInput>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: CreateApiKeyInput) => {
    setLoading(true);
    try {
      const created = await client.apiKeys.create(values);
      onCreated(created);
      form.resetFields();
      message.success("API key generated");
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to generate API key");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<span className="font-mono text-[14px]">Generate API Credential</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={440}
    >
      <Form<CreateApiKeyInput> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Identifier" rules={[{ required: true, message: "Key identifier is required" }]}>
          <Input autoFocus placeholder="e.g. production-agent, ci-pipeline" style={{ fontFamily: "var(--font-mono)" }} />
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity disabled:opacity-50"
            >
              {loading ? "Generating..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Key Created Modal (show raw key once) ────────────────────────────────────

function KeyCreatedModal({
  created,
  onClose,
}: {
  created: ApiKeyCreated | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      message.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error("Failed to copy to clipboard");
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-success" />
          <span className="font-mono text-[14px]">Credential Generated</span>
        </div>
      }
      open={!!created}
      onCancel={onClose}
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity"
          >
            Acknowledge
          </button>
        </div>
      }
      closable={false}
      maskClosable={false}
    >
      {/* Warning */}
      <div className="flex items-start gap-3 px-4 py-3 border border-dashed rounded-md bg-transparent mb-4" style={{ borderColor: "var(--color-warning)" }}>
        <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
        <span className="font-mono text-[12px] text-ink leading-relaxed">COPY THIS KEY NOW — IT WILL NOT BE DISPLAYED AGAIN</span>
      </div>

      {/* Key display */}
      <div className="flex items-center gap-2 px-4 py-3 border border-hairline rounded-md bg-canvas-soft">
        <code className="flex-1 font-mono text-[13px] text-ink break-all leading-relaxed">{created?.key}</code>
        <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center w-8 h-8 bg-transparent border border-hairline-soft rounded-md cursor-pointer text-muted hover:text-ink hover:border-hairline-strong transition-colors shrink-0"
          >
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          </button>
        </Tooltip>
      </div>

      {/* Key metadata */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-soft">Identifier:</span>
        <span className="font-mono text-[12px] text-ink">{created?.name}</span>
      </div>
    </Modal>
  );
}
