import { Dropdown, Form, Input, Modal, Select, Spin, Switch, message } from "antd";
import { AlertTriangle, ChevronRight, Copy, MoreVertical, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { CreateDynamicApiInput, DynamicApiItem } from "src/lib/types";
import DynamicApiDocsModal from "../components/DynamicApiDocsModal";

const { confirm } = Modal;

const METHOD_COLORS: Record<string, string> = {
  GET: "#1f8a65",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#8b5cf6",
  DELETE: "#cf2d56",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 rounded font-mono text-[10px] font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: `${METHOD_COLORS[method] || "#807d72"}15`,
        color: METHOD_COLORS[method] || "#807d72",
        minWidth: 52,
      }}
    >
      {method}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  DYNAMIC APIS LIST PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function DynamicApisListPage() {
  const navigate = useNavigate();
  const [apis, setApis] = useState<DynamicApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchApis = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.dynamicApis.list({
        search: search || undefined,
        method: methodFilter as DynamicApiItem["method"] | undefined,
        status: statusFilter as "active" | "inactive" | undefined,
      });
      setApis(result.items);
    } catch {
      message.error("Failed to load APIs");
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, statusFilter]);

  useEffect(() => {
    fetchApis();
  }, [fetchApis]);

  const handleDelete = (api: DynamicApiItem) => {
    confirm({
      title: <span className="font-mono text-[14px]">Delete Endpoint</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `Delete "${api.name}" (${api.method} ${api.path})? This action is irreversible.`,
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.dynamicApis.delete(api.id);
          setApis((prev) => prev.filter((a) => a.id !== api.id));
          message.success(`Deleted "${api.name}"`);
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleToggle = async (api: DynamicApiItem) => {
    try {
      const updated = await client.dynamicApis.update(api.id, {
        isActive: !api.isActive,
      });
      setApis((prev) => prev.map((a) => (a.id === api.id ? updated : a)));
      message.success(`${updated.name} is now ${updated.isActive ? "active" : "inactive"}`);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  const copyUrl = (api: DynamicApiItem) => {
    const url = `${API_BASE || window.location.origin}/apis${api.path}`;
    navigator.clipboard.writeText(url);
    message.success("URL copied");
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toISOString().split("T")[0];
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Dynamic APIs</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">Dynamic APIs</h1>
          <div className="flex items-center gap-3">
            <DynamicApiDocsModal />
            <button
              className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus size={16} />
              New API
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 border-b border-hairline flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[34px] pl-9 pr-3 rounded-md border border-hairline bg-surface-card text-ink text-[13px] outline-none focus:border-hairline-strong transition-colors"
          />
        </div>
        <Select
          placeholder="Method"
          allowClear
          value={methodFilter}
          onChange={(v) => setMethodFilter(v)}
          style={{ width: 110 }}
          options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
            label: m,
            value: m,
          }))}
        />
        <Select
          placeholder="Status"
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 110 }}
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px]">
            <Spin size="large" />
          </div>
        ) : apis.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-hairline-strong rounded-md bg-transparent m-auto max-w-[600px]">
            <Zap size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
            <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">NO ENDPOINTS</div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
            >
              Create First API
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {apis.map((api, idx) => (
              <div
                key={api.id}
                className="flex items-center gap-4 px-5 py-4 border border-hairline rounded-md bg-surface-card cursor-pointer transition-colors duration-150 hover:border-hairline-strong group animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]"
                style={{ animationDelay: `${idx * 0.03}s` }}
                onClick={() => navigate(`/dynamic-apis/${api.id}`)}
              >
                {/* Method badge */}
                <MethodBadge method={api.method} />

                {/* Path + Name */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0 overflow-hidden">
                  <span className="font-mono text-[13px] text-ink font-medium shrink-0">{api.path}</span>
                  <span className="text-[10px] text-muted-soft select-none shrink-0">·</span>
                  <span className="text-[12px] text-muted truncate">{api.name}</span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 min-w-[50px]" onClick={(e) => e.stopPropagation()}>
                  <Switch size="small" checked={api.isActive} onChange={() => handleToggle(api)} />
                </div>

                {/* Date */}
                <span className="font-mono text-[10px] text-muted-soft tracking-wider uppercase shrink-0">{formatDate(api.updatedAt)}</span>

                {/* Actions */}
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "edit",
                        icon: <Pencil size={14} />,
                        label: <span className="font-mono text-[12px]">Edit</span>,
                        onClick: (info) => {
                          info.domEvent.stopPropagation();
                          navigate(`/dynamic-apis/${api.id}`);
                        },
                      },
                      {
                        key: "copy",
                        icon: <Copy size={14} />,
                        label: <span className="font-mono text-[12px]">Copy URL</span>,
                        onClick: (info) => {
                          info.domEvent.stopPropagation();
                          copyUrl(api);
                        },
                      },
                      { type: "divider" },
                      {
                        key: "delete",
                        icon: <Trash2 size={14} />,
                        label: <span className="font-mono text-[12px]">Delete</span>,
                        danger: true,
                        onClick: (info) => {
                          info.domEvent.stopPropagation();
                          handleDelete(api);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <button
                    className="inline-flex items-center justify-center w-8 h-8 bg-transparent border-none cursor-pointer text-muted-soft rounded-sm p-0 transition-all duration-100 opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-canvas"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical size={16} />
                  </button>
                </Dropdown>

                <ChevronRight size={14} className="text-muted-soft shrink-0 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-ink" />
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateApiModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(api) => {
          setCreateModalOpen(false);
          navigate(`/dynamic-apis/${api.id}`);
        }}
      />
    </div>
  );
}

// ── Create API Modal ────────────────────────────────────────────────────────────

function CreateApiModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (api: DynamicApiItem) => void;
}) {
  const [form] = Form.useForm<CreateDynamicApiInput>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: CreateDynamicApiInput) => {
    setLoading(true);
    try {
      const api = await client.dynamicApis.create({
        name: values.name,
        method: values.method || "GET",
        path: values.path,
        description: values.description,
      });
      onCreated(api);
      form.resetFields();
      message.success(`API "${api.name}" created`);
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to create API");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New API Endpoint" open={open} onCancel={onClose} footer={null} destroyOnHidden width={520}>
      <Form<CreateDynamicApiInput>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        style={{ marginTop: 16 }}
        initialValues={{ method: "GET" }}
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: "Name is required" },
            { max: 255, message: "Max 255 characters" },
          ]}
        >
          <Input autoFocus placeholder="e.g. Get Users, Create Order" />
        </Form.Item>

        <div className="flex gap-3">
          <Form.Item name="method" label="Method" style={{ width: 130 }} rules={[{ required: true }]}>
            <Select
              options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
                label: m,
                value: m,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="path"
            label="Path"
            style={{ flex: 1 }}
            rules={[
              { required: true, message: "Path is required" },
              {
                pattern: /^\//,
                message: "Must start with /",
              },
            ]}
          >
            <Input placeholder="/users/:id" className="font-mono" />
          </Form.Item>
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity"
            >
              {loading ? "Creating..." : "Create API"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
