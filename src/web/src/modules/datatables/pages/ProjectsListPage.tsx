import { Dropdown, Form, Input, Modal, Spin, message } from "antd";
import { AlertTriangle, ChevronRight, Database, MoreVertical, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { ProjectItem, UpdateProjectInput } from "src/lib/types";

const { confirm } = Modal;

// ══════════════════════════════════════════════════════════════════════════════
//  PROJECTS LIST PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectItem | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.projects.list();
      setProjects(data);
    } catch {
      message.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = (db: ProjectItem) => {
    confirm({
      title: <span className="font-mono text-[14px]">Delete Project</span>,
      icon: <AlertTriangle size={20} className="text-red-500 mr-2" />,
      content: `Target: ${db.name}. Tables inside this project will be unlinked. This action is irreversible.`,
      okText: "Execute Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.projects.delete(db.id);
          setProjects((prev) => prev.filter((d) => d.id !== db.id));
          message.success("Project purged");
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toISOString().split("T")[0];
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">DataTables</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">Databases</h1>
          <button
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-opacity-90 transition-opacity cursor-pointer border-none"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} />
            Initialize Project
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px] flex-1">
            <Spin size="large" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] flex-1 border border-dashed border-hairline-strong rounded-md bg-transparent m-auto max-w-[600px]">
            <Database size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
            <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">DIRECTORY EMPTY</div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
            >
              Initialize First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((db, idx) => (
              <div
                key={db.id}
                className="flex flex-col gap-4 p-5 border border-hairline rounded-md bg-surface-card cursor-pointer transition-colors duration-150 ease-in-out hover:border-hairline-strong group opacity-0 animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                style={{ animationDelay: `${idx * 0.04}s` }}
                onClick={() => navigate(`/datatables/${db.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center justify-center w-10 h-10 rounded-md border border-hairline-soft bg-canvas text-muted shrink-0">
                    {db.icon || <Database size={18} strokeWidth={1.5} />}
                  </div>

                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: "edit",
                          icon: <Pencil size={14} />,
                          label: <span className="font-mono text-[12px]">Configure</span>,
                          onClick: (info) => {
                            info.domEvent.stopPropagation();
                            setEditProject(db);
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
                            handleDelete(db);
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
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-ink tracking-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1">{db.name}</div>
                  <div className="text-[13px] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-relaxed min-h-[19px]">
                    {db.description || "—"}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-hairline-soft pt-4 mt-auto">
                  <div className="flex items-center gap-2">
                    <Table2 size={13} className="text-muted-soft" />
                    <span className="font-mono text-[10px] text-muted-soft tracking-wider uppercase">{db.tableCount} TABLES</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted-soft tracking-wider uppercase">{formatDate(db.updatedAt)}</span>
                    <ChevronRight
                      size={14}
                      className="text-muted-soft shrink-0 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-ink"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(db) => {
          setCreateModalOpen(false);
          navigate(`/datatables/${db.id}`);
        }}
      />

      <EditProjectModal
        database={editProject}
        onClose={() => setEditProject(null)}
        onUpdated={() => {
          setEditProject(null);
          fetchProjects();
        }}
      />
    </div>
  );
}

// ── Create Database Modal ───────────────────────────────────────────────────────

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (db: ProjectItem) => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { name: string; description?: string }) => {
    setLoading(true);
    try {
      const db = await client.projects.create({
        name: values.name,
        description: values.description,
      });
      onCreated(db);
      form.resetFields();
      message.success(`Project "${db.name}" created`);
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to create project");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Project" open={open} onCancel={onClose} footer={null} destroyOnHidden width={480}>
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: "Project name is required" },
            { max: 255, message: "Max 255 characters" },
          ]}
        >
          <Input autoFocus placeholder="e.g. CRM, Inventory" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Optional description" showCount maxLength={1000} />
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-opacity-90 cursor-pointer transition-opacity"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Edit Project Modal ─────────────────────────────────────────────────────────

function EditProjectModal({
  database,
  onClose,
  onUpdated,
}: {
  database: ProjectItem | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form] = Form.useForm<UpdateProjectInput>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (database) {
      form.setFieldsValue({
        name: database.name,
        description: database.description ?? undefined,
      });
    }
  }, [database, form]);

  const handleSubmit = async (values: UpdateProjectInput) => {
    if (!database) return;
    setLoading(true);
    try {
      await client.projects.update(database.id, values);
      onUpdated();
      message.success("Project updated");
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to update project");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Edit Project" open={!!database} onCancel={onClose} footer={null} destroyOnHidden width={480}>
      <Form<UpdateProjectInput> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: "Project name is required" },
            { max: 255, message: "Max 255 characters" },
          ]}
        >
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-opacity-90 cursor-pointer transition-opacity"
            >
              {loading ? "Executing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
