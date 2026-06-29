import { Button, Form, Input, message } from "antd";
import { Lock, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "src/common/stores/auth.store";
import { client } from "src/lib/client";

interface LoginFormValues {
  login: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const result = await client.auth.login({
        login: values.login,
        password: values.password,
      });
      setUser(result.user);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 401) {
        message.error("Invalid username/email or password");
      } else {
        message.error(e.message ?? "Connection failed. Is the server running?");
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
        className="relative z-1 w-full max-w-[420px] bg-canvas border border-hairline rounded-xl shadow-[0_4px_24px_rgba(20,20,19,0.06)] animate-[loginSlideUp_0.5s_cubic-bezier(0.16,1,0.3,1)]"
        style={{ padding: "32px 32px 48px" }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-4">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="GomuStack" width={56} height={56} />
          </div>
          <h1 className="font-display text-[28px] font-normal tracking-tight text-ink leading-tight">GomuStack</h1>
          <p className="text-muted mt-2 text-sm">Sign in to your account</p>
        </div>

        <Form<LoginFormValues> layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
          <Form.Item name="login" label="Username or Email" rules={[{ required: true, message: "Please enter your username or email" }]}>
            <Input prefix={<User size={16} />} placeholder="admin" autoComplete="username" autoFocus />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true, message: "Please enter your password" }]}>
            <Input.Password prefix={<Lock size={16} />} placeholder="••••••••" autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
              Sign in
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
