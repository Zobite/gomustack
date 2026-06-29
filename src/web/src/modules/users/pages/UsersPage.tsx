import { Dropdown, Form, Input, Modal, Select, Spin, message } from "antd";
import { AlertTriangle, KeyRound, MoreVertical, Pencil, Plus, Shield, Trash2, User as UserIcon, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { CreateUserInput, UpdateUserInput, User } from "src/lib/types";

const { confirm } = Modal;

// ── Role badge styling ──────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, { label: string; icon: typeof Shield; className: string }> = {
  admin: {
    label: "ADMIN",
    icon: Shield,
    className: "text-ink",
  },
  member: {
    label: "MEMBER",
    icon: UserIcon,
    className: "text-muted-soft",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  USERS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setUsers(await client.users.list());
    } catch {
      message.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = (user: User) => {
    confirm({
      title: <span className="font-mono text-[14px]">Delete Account</span>,
      icon: <AlertTriangle size={20} className="text-error mr-2" />,
      content: `Target: ${user.name} (${user.email}). This action is irreversible.`,
      okText: "Execute Delete",
      okType: "danger",
      cancelText: "Cancel",
      async onOk() {
        try {
          await client.users.delete(user.id);
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          message.success("User account purged");
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Identity / User Accounts</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-display text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">User Directory</h1>
          <button
            className="flex items-center gap-2 h-[36px] px-4 rounded-md bg-ink text-canvas font-medium text-[13px] hover:bg-primary-active transition-colors cursor-pointer border-none shrink-0"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} />
            Create Account
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[240px] flex-1">
            <Spin size="large" />
          </div>
        ) : users.length === 0 ? (
          /* ── Empty State ─────────────────────────────── */
          <div className="flex flex-col items-center justify-center min-h-[300px] flex-1 border border-dashed border-hairline-strong rounded-md bg-transparent m-auto max-w-[600px]">
            <Users size={32} className="text-muted-soft mb-4" strokeWidth={1.5} />
            <div className="font-mono text-[12px] text-muted-soft uppercase tracking-wide mb-6">NO ACCOUNTS FOUND</div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-transparent border border-hairline-strong text-ink px-4 py-2 rounded-md font-medium text-[13px] hover:border-ink transition-colors cursor-pointer"
            >
              Initialize First Account
            </button>
          </div>
        ) : (
          /* ── User List ─────────────────────────────────── */
          <div className="flex flex-col gap-3">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_140px_200px_100px_100px_40px] gap-4 px-5 py-2">
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Identity</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Handle</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Email</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Role</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wider font-semibold">Created</span>
              <span />
            </div>

            {users.map((user, idx) => {
              const roleStyle = ROLE_STYLES[user.role] ?? ROLE_STYLES.member;
              const RoleIcon = roleStyle.icon;

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[1fr_140px_200px_100px_100px_40px] gap-4 items-center px-5 py-3.5 border border-hairline rounded-md bg-surface-card transition-colors duration-150 hover:border-hairline-strong group animate-[fadeInUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* Name + avatar initial */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border border-hairline-soft bg-canvas text-muted shrink-0 font-mono text-[11px] font-semibold uppercase">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-[14px] font-medium text-ink tracking-tight truncate">{user.name}</span>
                  </div>

                  {/* Username */}
                  <span className="font-mono text-[12px] text-muted tracking-wide truncate">{user.username ?? "—"}</span>

                  {/* Email */}
                  <span className="text-[13px] text-muted truncate">{user.email}</span>

                  {/* Role */}
                  <div className={`inline-flex items-center gap-1.5 ${roleStyle.className}`}>
                    <RoleIcon size={12} strokeWidth={1.5} />
                    <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">{roleStyle.label}</span>
                  </div>

                  {/* Created */}
                  <span className="font-mono text-[11px] text-muted-soft tracking-wide">{formatDate(user.createdAt)}</span>

                  {/* Actions dropdown */}
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: "edit",
                          icon: <Pencil size={14} />,
                          label: <span className="font-mono text-[12px]">Configure</span>,
                          onClick: () => setEditUser(user),
                        },
                        {
                          key: "reset-pw",
                          icon: <KeyRound size={14} />,
                          label: <span className="font-mono text-[12px]">Reset Passkey</span>,
                          onClick: () => setResetUser(user),
                        },
                        { type: "divider" as const },
                        {
                          key: "delete",
                          icon: <Trash2 size={14} />,
                          label: <span className="font-mono text-[12px]">Delete</span>,
                          danger: true,
                          onClick: () => handleDelete(user),
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
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && users.length > 0 && (
          <div className="flex justify-between items-center pt-6">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-soft">
              {users.length} ACCOUNT{users.length !== 1 ? "S" : ""} REGISTERED
            </span>
          </div>
        )}
      </div>

      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(user) => {
          setUsers((prev) => [...prev, user]);
          setCreateModalOpen(false);
        }}
      />

      <EditUserModal
        user={editUser}
        onClose={() => setEditUser(null)}
        onUpdated={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setEditUser(null);
        }}
      />

      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
    </div>
  );
}

// ── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
}) {
  const [form] = Form.useForm<CreateUserInput>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: CreateUserInput) => {
    setLoading(true);
    try {
      const user = await client.users.create(values);
      onCreated(user);
      form.resetFields();
      message.success("Account initialized");
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={<span className="font-mono text-[14px]">Initialize Account</span>} open={open} onCancel={onClose} footer={null} destroyOnHidden width={440}>
      <Form<CreateUserInput>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{ role: "member" }}
        style={{ marginTop: 16 }}
      >
        <Form.Item name="name" label="Display Name" rules={[{ required: true, message: "Display name is required" }]}>
          <Input autoFocus placeholder="Jane Doe" />
        </Form.Item>

        <Form.Item
          name="username"
          label="Handle"
          rules={[
            { required: true, message: "Handle is required" },
            { min: 2, message: "At least 2 characters" },
            { max: 32, message: "At most 32 characters" },
          ]}
        >
          <Input placeholder="jane.doe" style={{ fontFamily: "var(--font-mono)" }} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Invalid email format" },
          ]}
        >
          <Input placeholder="jane@example.com" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Passkey"
          rules={[
            { required: true, message: "Passkey is required" },
            { min: 8, message: "Minimum 8 characters" },
          ]}
        >
          <Input.Password placeholder="min. 8 characters" />
        </Form.Item>

        <Form.Item name="role" label="Access Level">
          <Select>
            <Select.Option value="member">Member</Select.Option>
            <Select.Option value="admin">Admin</Select.Option>
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity disabled:opacity-50"
            >
              {loading ? "Initializing..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: User | null;
  onClose: () => void;
  onUpdated: (user: User) => void;
}) {
  const [form] = Form.useForm<UpdateUserInput>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username ?? "",
        email: user.email,
        name: user.name,
        role: user.role as "admin" | "member",
      });
    }
  }, [user, form]);

  const handleSubmit = async (values: UpdateUserInput) => {
    if (!user) return;
    setLoading(true);
    try {
      const updated = await client.users.update(user.id, values);
      onUpdated(updated);
      message.success("Account configuration updated");
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to update account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={<span className="font-mono text-[14px]">Configure Account</span>} open={!!user} onCancel={onClose} footer={null} destroyOnHidden width={440}>
      <Form<UpdateUserInput> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Display Name" rules={[{ required: true, message: "Display name is required" }]}>
          <Input />
        </Form.Item>

        <Form.Item
          name="username"
          label="Handle"
          rules={[
            { required: true, message: "Handle is required" },
            { min: 2, message: "At least 2 characters" },
            { max: 32, message: "At most 32 characters" },
          ]}
        >
          <Input style={{ fontFamily: "var(--font-mono)" }} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Invalid email format" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="role" label="Access Level">
          <Select>
            <Select.Option value="member">Member</Select.Option>
            <Select.Option value="admin">Admin</Select.Option>
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity disabled:opacity-50"
            >
              {loading ? "Committing..." : "Commit Changes"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ password: string; confirmPassword: string }>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      await client.users.resetPassword(user.id, values.password);
      message.success(`Passkey reset for ${user.name}`);
      form.resetFields();
      onClose();
    } catch (err) {
      if (err instanceof GomuStackError) {
        message.error(err.message);
      } else {
        message.error("Failed to reset passkey");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-muted" />
          <span className="font-mono text-[14px]">Reset Passkey</span>
        </div>
      }
      open={!!user}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={null}
      destroyOnHidden
      width={440}
    >
      {/* Target user info */}
      <div className="flex items-center gap-3 px-4 py-3 border border-hairline rounded-md bg-canvas-soft mb-4 mt-4">
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-hairline-soft bg-canvas text-muted shrink-0 font-mono text-[10px] font-semibold uppercase">
          {user?.name.charAt(0)}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-ink">{user?.name}</span>
          <span className="font-mono text-[11px] text-muted-soft">{user?.email}</span>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="password"
          label="New Passkey"
          rules={[
            { required: true, message: "Passkey is required" },
            { min: 8, message: "Minimum 8 characters" },
          ]}
        >
          <Input.Password autoFocus placeholder="min. 8 characters" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm Passkey"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please confirm the passkey" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Passkeys do not match"));
              },
            }),
          ]}
        >
          <Input.Password placeholder="Re-enter passkey" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                form.resetFields();
                onClose();
              }}
              className="px-4 py-2 bg-transparent border border-hairline rounded-md text-ink font-medium text-[13px] hover:bg-canvas cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-opacity disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Execute Reset"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
