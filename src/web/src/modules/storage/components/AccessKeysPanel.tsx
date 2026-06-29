import { Alert, Button, Empty, Form, Input, Modal, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { AlertTriangle, Copy, Eye, EyeOff, Key, Plus, Power, PowerOff, RefreshCw, Shield, Terminal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { StorageAccessKeyCreated, StorageAccessKeyItem } from "src/lib/types";

const { Text } = Typography;
const { confirm } = Modal;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccessKeysPanel() {
  const [keys, setKeys] = useState<StorageAccessKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<StorageAccessKeyCreated | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.storage.listAccessKeys();
      setKeys(result.items);
    } catch {
      message.error("Failed to load access keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleToggleActive = async (key: StorageAccessKeyItem) => {
    try {
      await client.storage.updateAccessKey(key.id, { isActive: !key.isActive });
      message.success(key.isActive ? "Key disabled" : "Key enabled");
      fetchKeys();
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  const handleDelete = (key: StorageAccessKeyItem) => {
    confirm({
      title: `Delete access key "${key.label || key.accessKey}"?`,
      icon: <AlertTriangle size={20} style={{ color: "var(--color-error)", marginRight: 8 }} />,
      content: "Any application using this key will immediately lose access.",
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.storage.deleteAccessKey(key.id);
          message.success("Access key deleted");
          fetchKeys();
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label} copied`);
    } catch {
      message.error("Failed to copy");
    }
  };

  const columns: ColumnsType<StorageAccessKeyItem> = [
    {
      title: "Label",
      dataIndex: "label",
      key: "label",
      render: (label: string) => (
        <Text strong style={{ fontSize: 13 }}>
          {label || "—"}
        </Text>
      ),
    },
    {
      title: "Access Key",
      dataIndex: "accessKey",
      key: "accessKey",
      render: (ak: string) => (
        <Space size={4}>
          <Text code style={{ fontSize: 12 }}>
            {ak}
          </Text>
          <Tooltip title="Copy">
            <Button type="text" size="small" icon={<Copy size={12} />} onClick={() => handleCopy(ak, "Access Key")} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      render: (active: boolean) =>
        active ? (
          <Tag color="green" icon={<Power size={10} style={{ marginRight: 4 }} />}>
            Active
          </Tag>
        ) : (
          <Tag color="default" icon={<PowerOff size={10} style={{ marginRight: 4 }} />}>
            Disabled
          </Tag>
        ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (ts: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(ts)}
        </Text>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right" as const,
      width: 120,
      render: (_: unknown, record: StorageAccessKeyItem) => (
        <Space size={4}>
          <Tooltip title={record.isActive ? "Disable" : "Enable"}>
            <Button type="text" size="small" icon={record.isActive ? <PowerOff size={14} /> : <Power size={14} />} onClick={() => handleToggleActive(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const s3Endpoint = `${window.location.origin}/s3`;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>
            Access Keys
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Manage access key pairs for S3-compatible API authentication
          </Text>
        </div>
        <Space>
          <Button size="medium" icon={<RefreshCw size={14} />} onClick={fetchKeys}>
            Refresh
          </Button>
          <Button type="primary" size="medium" icon={<Plus size={14} />} onClick={() => setCreateModalOpen(true)}>
            Create Access Key
          </Button>
        </Space>
      </div>

      {/* S3 Connection Info */}
      <Alert
        message="S3-compatible API"
        description={
          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 8 }}>
              Create an access key below, then connect from any S3-compatible client. The S3 endpoint is at <Text code>{s3Endpoint}</Text>
            </div>
            <pre
              style={{
                background: "var(--color-surface-dark)",
                borderRadius: 8,
                padding: "10px 14px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-on-dark)",
                lineHeight: 1.7,
                overflowX: "auto",
                margin: 0,
              }}
            >
              {`// @aws-sdk/client-s3
const s3 = new S3Client({
  endpoint: "${s3Endpoint}",
  forcePathStyle: true,
  region: "us-east-1",
  credentials: {
    accessKeyId: "YOUR_ACCESS_KEY",
    secretAccessKey: "YOUR_SECRET_KEY",
  },
});`}
            </pre>
          </div>
        }
        type="info"
        icon={<Terminal size={16} />}
        showIcon
        style={{ marginBottom: 16, borderRadius: 10, background: "var(--color-canvas-soft)", border: "1px solid var(--color-hairline-soft)" }}
      />

      {/* Table */}
      <Table
        columns={columns}
        dataSource={keys}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No access keys created yet" /> }}
        style={{ borderRadius: 12, overflow: "hidden" }}
      />

      <CreateAccessKeyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(key) => {
          setCreateModalOpen(false);
          setCreatedKey(key);
          fetchKeys();
        }}
      />

      {createdKey && <SecretKeyModal keyData={createdKey} onClose={() => setCreatedKey(null)} />}
    </div>
  );
}

// ── Create Access Key Modal ─────────────────────────────────────────────────────

function CreateAccessKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: StorageAccessKeyCreated) => void;
}) {
  const [form] = Form.useForm<{ label: string }>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { label: string }) => {
    setLoading(true);
    try {
      const result = await client.storage.createAccessKey({ label: values.label });
      onCreated(result);
      form.resetFields();
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to create access key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Key size={18} />
          Create Access Key
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={460}
    >
      <Form<{ label: string }> form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item
          name="label"
          label="Label"
          rules={[{ required: true, message: "Label is required" }]}
          extra="A descriptive label to identify this key (e.g., 'My App', 'CI/CD Pipeline')"
        >
          <Input autoFocus placeholder="My Application" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ float: "right" }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Key
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Secret Key Display Modal ────────────────────────────────────────────────────

function SecretKeyModal({ keyData, onClose }: { keyData: StorageAccessKeyCreated; onClose: () => void }) {
  const [showSecret, setShowSecret] = useState(true);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label} copied`);
    } catch {
      message.error("Failed to copy");
    }
  };

  const s3Endpoint = `${window.location.origin}/s3`;

  return (
    <Modal
      title={
        <Space>
          <Shield size={18} style={{ color: "var(--color-warning)" }} />
          Access Key Created
        </Space>
      }
      open
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          I've saved my keys
        </Button>
      }
      width={560}
      closable={false}
      maskClosable={false}
    >
      <Alert
        message="Save your secret key now!"
        description="The secret key will only be shown once. Make sure to copy and store it securely."
        type="warning"
        showIcon
        icon={<AlertTriangle size={16} />}
        style={{ marginBottom: 16, marginTop: 12, borderRadius: 10 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Label
        </Text>
        <Text strong>{keyData.label}</Text>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Access Key
        </Text>
        <Space>
          <Text code style={{ fontSize: 13, userSelect: "all" }}>
            {keyData.accessKey}
          </Text>
          <Button type="text" size="medium" icon={<Copy size={12} />} onClick={() => handleCopy(keyData.accessKey, "Access Key")} />
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          Secret Key
        </Text>
        <Space>
          <Text code style={{ fontSize: 13, userSelect: "all", filter: showSecret ? "none" : "blur(4px)", transition: "filter 0.2s" }}>
            {keyData.secretKey}
          </Text>
          <Button type="text" size="medium" icon={showSecret ? <EyeOff size={12} /> : <Eye size={12} />} onClick={() => setShowSecret(!showSecret)} />
          <Button type="text" size="medium" icon={<Copy size={12} />} onClick={() => handleCopy(keyData.secretKey, "Secret Key")} />
        </Space>
      </div>

      <pre
        style={{
          background: "var(--color-surface-dark)",
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-on-dark)",
          lineHeight: 1.7,
          overflowX: "auto",
          margin: 0,
        }}
      >
        {`// S3 client configuration
const s3 = new S3Client({
  endpoint: "${s3Endpoint}",
  forcePathStyle: true,
  region: "us-east-1",
  credentials: {
    accessKeyId: "${keyData.accessKey}",
    secretAccessKey: "${keyData.secretKey}",
  },
});`}
      </pre>
    </Modal>
  );
}
