import { Button, Form, Input, InputNumber, Modal, Tabs, Tooltip } from "antd";
import { Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { BrowserProfileItem } from "src/lib/resources/browser";

interface ProfileModalProps {
  open: boolean;
  editingProfile: BrowserProfileItem | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    description?: string;
    proxyConfig?: Record<string, unknown>;
    fingerprintConfig?: Record<string, unknown>;
  }) => void;
}

const RANDOM_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

const RANDOM_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function ProfileModal({ open, editingProfile, loading, onCancel, onSubmit }: ProfileModalProps) {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (open) {
      setActiveTab("general");
      if (editingProfile) {
        const proxyConfig = editingProfile.proxyConfig ? JSON.parse(editingProfile.proxyConfig) : null;
        const fingerprintConfig = editingProfile.fingerprintConfig ? JSON.parse(editingProfile.fingerprintConfig) : null;
        form.setFieldsValue({ name: editingProfile.name, description: editingProfile.description, proxyConfig, fingerprintConfig });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingProfile, form]);

  const handleGenerateFingerprint = () => {
    form.setFieldsValue({
      fingerprintConfig: {
        userAgent: pickRandom(RANDOM_USER_AGENTS),
        viewport: pickRandom(RANDOM_VIEWPORTS),
        locale: "en-US",
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
        geolocation: { latitude: 10.762622, longitude: 106.660172, accuracy: 100 },
      },
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch {
      // form validate failed — Ant shows inline errors
    }
  };

  return (
    <Modal
      title={editingProfile ? "Edit Browser Profile" : "Create Browser Profile"}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={editingProfile ? "Save Changes" : "Create Profile"}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "general",
              label: <span className="font-mono text-[11px] uppercase tracking-wider">General</span>,
              children: (
                <div className="flex flex-col gap-4 py-2">
                  <Form.Item
                    name="name"
                    label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Profile Name</span>}
                    rules={[{ required: true, message: "Profile name is required" }]}
                  >
                    <Input placeholder="e.g. Scraper Facebook #1" />
                  </Form.Item>
                  <Form.Item
                    name="description"
                    label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Description (optional)</span>}
                  >
                    <Input.TextArea rows={3} placeholder="Purpose of this browser profile" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: "proxy",
              label: <span className="font-mono text-[11px] uppercase tracking-wider">Proxy</span>,
              children: (
                <div className="flex flex-col gap-4 py-2">
                  <Form.Item
                    name={["proxyConfig", "server"]}
                    label={
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Server URL</span>
                        <Tooltip title="HTTP or SOCKS5 proxy URL, e.g. http://ip:port">
                          <Info size={13} className="text-muted-soft" />
                        </Tooltip>
                      </div>
                    }
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("socks5://")) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("Must start with http://, https://, or socks5://"));
                        },
                      },
                    ]}
                  >
                    <Input placeholder="http://127.0.0.1:8080" />
                  </Form.Item>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      name={["proxyConfig", "username"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Username</span>}
                    >
                      <Input placeholder="Optional" />
                    </Form.Item>
                    <Form.Item
                      name={["proxyConfig", "password"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Password</span>}
                    >
                      <Input.Password placeholder="Optional" />
                    </Form.Item>
                  </div>
                </div>
              ),
            },
            {
              key: "fingerprint",
              label: <span className="font-mono text-[11px] uppercase tracking-wider">Fingerprint</span>,
              children: (
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-muted">Canvas, user agent, and screen settings.</span>
                    <Button
                      type="default"
                      size="small"
                      icon={<Sparkles size={12} className="text-accent-amber" />}
                      onClick={handleGenerateFingerprint}
                      className="font-mono text-[11px] uppercase tracking-wider"
                    >
                      Generate
                    </Button>
                  </div>

                  <Form.Item
                    name={["fingerprintConfig", "userAgent"]}
                    label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">User Agent</span>}
                  >
                    <Input placeholder="Auto-generated if empty" />
                  </Form.Item>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      name={["fingerprintConfig", "viewport", "width"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Width</span>}
                    >
                      <InputNumber min={320} max={3840} className="w-full" placeholder="1280" />
                    </Form.Item>
                    <Form.Item
                      name={["fingerprintConfig", "viewport", "height"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Height</span>}
                    >
                      <InputNumber min={240} max={2160} className="w-full" placeholder="800" />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      name={["fingerprintConfig", "locale"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Locale</span>}
                    >
                      <Input placeholder="en-US" />
                    </Form.Item>
                    <Form.Item
                      name={["fingerprintConfig", "timezoneId"]}
                      label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Timezone</span>}
                    >
                      <Input placeholder="Asia/Ho_Chi_Minh" />
                    </Form.Item>
                  </div>

                  <div className="border border-hairline rounded-md p-3 bg-canvas-soft">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold block mb-2">Geolocation Overrides</span>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item
                        name={["fingerprintConfig", "geolocation", "latitude"]}
                        label={<span className="font-mono text-[10px] uppercase tracking-wider text-muted">Latitude</span>}
                      >
                        <InputNumber min={-90} max={90} step={0.000001} className="w-full" placeholder="10.762622" />
                      </Form.Item>
                      <Form.Item
                        name={["fingerprintConfig", "geolocation", "longitude"]}
                        label={<span className="font-mono text-[10px] uppercase tracking-wider text-muted">Longitude</span>}
                      >
                        <InputNumber min={-180} max={180} step={0.000001} className="w-full" placeholder="106.660172" />
                      </Form.Item>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
