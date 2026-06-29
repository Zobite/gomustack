import { Button, Form, Input, message } from "antd";
import { KeyRound, Mail, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "src/common/stores/auth.store";
import { client } from "src/lib/client";

interface SetupFormValues {
  username: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (values: SetupFormValues) => {
    setLoading(true);
    try {
      const result = await client.auth.setup({
        username: values.username,
        email: values.email,
        password: values.password,
        name: values.name,
      });
      setUser(result.user);
      message.success("Admin account created! Welcome to GomuStack.");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.message?.includes("already")) {
        message.error("System is already set up. Redirecting to login...");
        setTimeout(() => navigate("/login", { replace: true }), 1500);
      } else {
        message.error(e.message ?? "Setup failed. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden p-4">
      {/* Radial glow — top-right (ink) */}
      <div className="absolute -top-[30%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-[radial-gradient(circle,rgba(38,37,30,0.04)_0%,transparent_70%)] pointer-events-none" />
      {/* Radial glow — bottom-left (muted) */}
      <div className="absolute -bottom-[20%] -left-[15%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(128,125,114,0.03)_0%,transparent_70%)] pointer-events-none" />
      <div
        className="relative z-1 w-full max-w-[460px] bg-canvas border border-hairline rounded-xl shadow-[0_4px_24px_rgba(20,20,19,0.06)] animate-[loginSlideUp_0.5s_cubic-bezier(0.16,1,0.3,1)]"
        style={{ padding: "32px 32px 48px" }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-4">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="GomuStack" width={56} height={56} />
          </div>
          <h1 className="font-display text-[28px] font-normal tracking-tight text-ink leading-tight">Welcome to GomuStack</h1>
          <p className="text-muted mt-2 text-sm">Create your admin account to get started</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-6 rounded-lg bg-[var(--surface-raised)] border border-hairline text-xs text-muted">
          <ShieldCheck size={14} className="shrink-0 text-success" />
          <span>This page is only available on first run. Once an admin is created, it will be disabled.</span>
        </div>

        <Form<SetupFormValues> layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
          <Form.Item name="name" label="Display Name" rules={[{ required: true, message: "Please enter your name" }]}>
            <Input prefix={<User size={16} />} placeholder="Admin" autoComplete="name" autoFocus />
          </Form.Item>

          <Form.Item name="username" label="Username" rules={[{ required: true, message: "Please enter a username" }, { min: 3, message: "Username must be at least 3 characters" }]}>
            <Input prefix={<User size={16} />} placeholder="admin" autoComplete="username" />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Please enter your email" }, { type: "email", message: "Please enter a valid email" }]}>
            <Input prefix={<Mail size={16} />} placeholder="admin@example.com" autoComplete="email" />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true, message: "Please enter a password" }, { min: 8, message: "Password must be at least 8 characters" }]}>
            <Input.Password prefix={<KeyRound size={16} />} placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<KeyRound size={16} />} placeholder="••••••••" autoComplete="new-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
              Create Admin & Get Started
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
