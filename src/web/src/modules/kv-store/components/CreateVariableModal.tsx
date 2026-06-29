import { Form, Input, InputNumber, Modal, Switch } from "antd";
import { useState } from "react";

interface CreateVariableModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { key: string; value: string; ttl?: number }) => void;
}

/**
 * Pure form modal — no API calls.
 * Collects key/value/ttl and delegates submission to parent via onSubmit.
 */
export default function CreateVariableModal({ open, loading, onClose, onSubmit }: CreateVariableModalProps) {
  const [form] = Form.useForm();
  const [enableTtl, setEnableTtl] = useState(false);

  const handleFinish = (values: any) => {
    onSubmit({
      key: values.key,
      value: values.value,
      ttl: enableTtl ? values.ttl : undefined,
    });
    form.resetFields();
    setEnableTtl(false);
  };

  return (
    <Modal title={<span className="font-mono text-[14px]">Register Variable</span>} open={open} onCancel={onClose} footer={null} destroyOnHidden width={440}>
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item
          name="key"
          label="Key"
          rules={[
            { required: true, message: "Key is required" },
            { max: 255, message: "Max 255 characters" },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: "Only alphanumeric, dots, hyphens, underscores" },
          ]}
        >
          <Input autoFocus placeholder="my.config.key" style={{ fontFamily: "var(--font-mono)" }} />
        </Form.Item>

        <Form.Item name="value" label="Value" rules={[{ required: true, message: "Value is required" }]}>
          <Input.TextArea rows={4} placeholder="Enter value" style={{ fontFamily: "var(--font-mono)" }} />
        </Form.Item>

        <div className="flex items-center gap-3 mb-5">
          <Switch checked={enableTtl} onChange={(checked) => setEnableTtl(checked)} size="small" />
          <span className="text-[13px] text-muted">Set TTL (auto-expire)</span>
          {enableTtl && (
            <Form.Item name="ttl" noStyle rules={[{ required: enableTtl }]}>
              <InputNumber min={1} placeholder="seconds" addonAfter="sec" style={{ width: 160 }} />
            </Form.Item>
          )}
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
              className="px-4 py-2 bg-ink text-canvas border-none rounded-md font-medium text-[13px] hover:bg-primary-active cursor-pointer transition-colors disabled:opacity-50"
            >
              {loading ? "Registering..." : "Execute"}
            </button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
