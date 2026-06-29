import { App, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";

interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateServerDialog({ open, onClose }: CreateServerDialogProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const server = await client.mcpToolServers.create({
        name: values.name,
        description: values.description || undefined,
      });
      message.success(`Server "${server.name}" created`);
      form.resetFields();
      onClose();
      navigate(`/mcp-servers/${server.id}`);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="New MCP Server"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okText="Create"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
        <Form.Item
          name="name"
          label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Server Name</span>}
          rules={[
            { required: true, message: "Server name is required" },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: "Only alphanumeric, hyphens, underscores",
            },
            { max: 100, message: "Max 100 characters" },
          ]}
        >
          <Input placeholder="e.g. my-tools" className="font-mono" />
        </Form.Item>
        <Form.Item
          name="description"
          label={<span className="font-mono text-[11px] uppercase tracking-wider text-muted">Description (optional)</span>}
          rules={[{ max: 1000, message: "Max 1000 characters" }]}
        >
          <Input.TextArea rows={3} placeholder="What tools will this server contain?" showCount maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
