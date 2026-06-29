import {
  Breadcrumb,
  Button,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileIcon,
  FileText,
  Film,
  FolderClosed,
  FolderOpen,
  Globe,
  HardDrive,
  Image,
  Key,
  Layers,
  Link,
  Lock,
  MoreHorizontal,
  Music,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import type { Bucket, CreateBucketInput, StorageObject } from "src/lib/types";
import AccessKeysPanel from "../components/AccessKeysPanel";
import StorageApiDocsPanel from "../components/StorageApiDocsModal";

const { Text } = Typography;
const { confirm } = Modal;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(contentType: string, size?: number) {
  const s = size ?? 16;
  if (contentType.startsWith("image/")) return <Image size={s} />;
  if (contentType.startsWith("video/")) return <Film size={s} />;
  if (contentType.startsWith("audio/")) return <Music size={s} />;
  if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml")) return <FileText size={s} />;
  if (contentType.includes("zip") || contentType.includes("gzip") || contentType.includes("tar") || contentType.includes("rar")) return <Archive size={s} />;
  return <FileIcon size={s} />;
}

function getContentTypeColor(contentType: string): string {
  if (contentType.startsWith("image/")) return "blue";
  if (contentType.startsWith("video/")) return "purple";
  if (contentType.startsWith("audio/")) return "magenta";
  if (contentType.startsWith("text/") || contentType.includes("json")) return "green";
  if (contentType.includes("pdf")) return "red";
  if (contentType.includes("zip") || contentType.includes("gzip")) return "orange";
  return "default";
}

type ViewMode = "buckets" | "objects" | "access-keys" | "api-prompt";

// ══════════════════════════════════════════════════════════════════════════════
//  STORAGE PAGE — MinIO/S3-style Object Browser
// ══════════════════════════════════════════════════════════════════════════════

export default function StoragePage() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [commonPrefixes, setCommonPrefixes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });
  const [stats, setStats] = useState({ bucketCount: 0, objectCount: 0, totalSize: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>("buckets");

  // Modals
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [presignModalOpen, setPresignModalOpen] = useState<StorageObject | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── Fetch Buckets ────────────────────────────────────────────────────────────

  const fetchBuckets = useCallback(async () => {
    try {
      const result = await client.storage.listBuckets();
      setBuckets(result.items);
    } catch {
      message.error("Failed to load buckets");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await client.storage.stats();
      setStats(s);
    } catch {
      // silent
    }
  }, []);

  // ── Fetch Objects ────────────────────────────────────────────────────────────

  const fetchObjects = useCallback(async () => {
    if (!selectedBucket) return;
    setObjectsLoading(true);
    try {
      const result = await client.storage.listObjects(selectedBucket.name, {
        prefix: currentPrefix || undefined,
        delimiter: "/",
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
      });
      setObjects(result.items);
      setCommonPrefixes(result.commonPrefixes ?? []);
      setPagination((prev) => ({ ...prev, total: result.meta.total }));
    } catch {
      message.error("Failed to load objects");
    } finally {
      setObjectsLoading(false);
    }
  }, [selectedBucket, currentPrefix, debouncedSearch, pagination.page, pagination.limit]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBuckets(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchBuckets, fetchStats]);

  useEffect(() => {
    if (viewMode === "objects") {
      fetchObjects();
    }
  }, [fetchObjects, viewMode]);

  // ── Bucket Actions ──────────────────────────────────────────────────────────

  const handleSelectBucket = (bucket: Bucket) => {
    setSelectedBucket(bucket);
    setCurrentPrefix("");
    setSearchText("");
    setDebouncedSearch("");
    setSelectedRowKeys([]);
    setPagination((p) => ({ ...p, page: 1 }));
    setViewMode("objects");
  };

  const handleBackToBuckets = () => {
    setSelectedBucket(null);
    setViewMode("buckets");
    setObjects([]);
    setCommonPrefixes([]);
    setSearchText("");
    setDebouncedSearch("");
    setSelectedRowKeys([]);
    fetchBuckets();
    fetchStats();
  };

  const handleDeleteBucket = (bucket: Bucket) => {
    confirm({
      title: `Delete bucket "${bucket.name}"?`,
      icon: <AlertTriangle size={20} style={{ color: "var(--color-error)", marginRight: 8 }} />,
      content:
        bucket.objectCount > 0
          ? `This bucket contains ${bucket.objectCount} object(s). All files will be permanently deleted.`
          : "This bucket will be permanently deleted.",
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.storage.deleteBucket(bucket.name, true);
          message.success("Bucket deleted");
          if (selectedBucket?.name === bucket.name) {
            handleBackToBuckets();
          }
          fetchBuckets();
          fetchStats();
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleToggleBucketPublic = async (bucket: Bucket) => {
    try {
      await client.storage.updateBucket(bucket.name, { isPublic: !bucket.isPublic });
      message.success(`Bucket is now ${bucket.isPublic ? "private" : "public"}`);
      fetchBuckets();
      if (selectedBucket?.name === bucket.name) {
        setSelectedBucket({ ...bucket, isPublic: !bucket.isPublic });
      }
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  // ── Object Actions ──────────────────────────────────────────────────────────

  const handleDeleteObject = (obj: StorageObject) => {
    if (!selectedBucket) return;
    confirm({
      title: `Delete "${obj.key.split("/").pop()}"?`,
      icon: <AlertTriangle size={20} style={{ color: "var(--color-error)", marginRight: 8 }} />,
      content: "This file will be permanently deleted.",
      okText: "Delete",
      okType: "danger",
      async onOk() {
        try {
          await client.storage.deleteObject(selectedBucket.name, obj.key);
          message.success("File deleted");
          fetchObjects();
          fetchBuckets();
          fetchStats();
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (!selectedBucket || selectedRowKeys.length === 0) return;
    const keys = objects.filter((o) => selectedRowKeys.includes(o.id)).map((o) => o.key);
    confirm({
      title: `Delete ${keys.length} file(s)?`,
      icon: <AlertTriangle size={20} style={{ color: "var(--color-error)", marginRight: 8 }} />,
      content: "These files will be permanently deleted.",
      okText: "Delete All",
      okType: "danger",
      async onOk() {
        try {
          await client.storage.bulkDelete(selectedBucket.name, keys);
          message.success(`${keys.length} file(s) deleted`);
          setSelectedRowKeys([]);
          fetchObjects();
          fetchBuckets();
          fetchStats();
        } catch (err) {
          if (err instanceof GomuStackError) message.error(err.message);
        }
      },
    });
  };

  const handleTogglePublic = async (obj: StorageObject) => {
    if (!selectedBucket) return;
    try {
      await client.storage.updateObject(selectedBucket.name, obj.key, { isPublic: !obj.isPublic });
      message.success(`File is now ${obj.isPublic ? "private" : "public"}`);
      fetchObjects();
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
    }
  };

  const handleCopyUrl = async (obj: StorageObject) => {
    if (!selectedBucket) return;
    const url = `${window.location.origin}/public/${selectedBucket.name}/${obj.key}`;
    try {
      await navigator.clipboard.writeText(url);
      message.success("URL copied to clipboard");
    } catch {
      message.error("Failed to copy");
    }
  };

  const handleDownload = (obj: StorageObject) => {
    if (!selectedBucket) return;
    const url = `${window.location.origin}/api/storage/buckets/${selectedBucket.name}/objects/${obj.key}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = obj.key.split("/").pop() ?? "download";
    const token = localStorage.getItem("access_token");
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.click();
        URL.revokeObjectURL(objUrl);
      })
      .catch(() => message.error("Download failed"));
  };

  // ── Navigate prefix ("folder") ──────────────────────────────────────────────

  const navigateToPrefix = (prefix: string) => {
    setCurrentPrefix(prefix);
    setSearchText("");
    setDebouncedSearch("");
    setSelectedRowKeys([]);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const breadcrumbParts = useMemo(() => {
    if (!currentPrefix) return [];
    const parts = currentPrefix.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      label: part,
      prefix: parts.slice(0, i + 1).join("/") + "/",
    }));
  }, [currentPrefix]);

  // ── Object context menu ─────────────────────────────────────────────────────

  const getObjectMenuItems = (obj: StorageObject): MenuProps["items"] => [
    {
      key: "download",
      icon: <Download size={14} />,
      label: "Download",
      onClick: () => handleDownload(obj),
    },
    ...(obj.isPublic
      ? [
          {
            key: "copy-url",
            icon: <Copy size={14} />,
            label: "Copy Public URL",
            onClick: () => handleCopyUrl(obj),
          },
        ]
      : []),
    {
      key: "presign",
      icon: <Link size={14} />,
      label: "Get Presigned URL",
      onClick: () => setPresignModalOpen(obj),
    },
    { type: "divider" as const },
    {
      key: "toggle-public",
      icon: obj.isPublic ? <Lock size={14} /> : <Globe size={14} />,
      label: obj.isPublic ? "Make Private" : "Make Public",
      onClick: () => handleTogglePublic(obj),
    },
    { type: "divider" as const },
    {
      key: "delete",
      icon: <Trash2 size={14} />,
      label: "Delete",
      danger: true,
      onClick: () => handleDeleteObject(obj),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-12 py-8 flex justify-center pt-[120px]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left Sidebar ─────────────────────────────── */}
      <div className="w-[220px] min-w-[220px] bg-surface-soft border-r border-hairline flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 pb-4 pt-6 border-b border-hairline">
          <HardDrive size={18} className="text-primary" />
          <span className="font-display text-[15px] font-semibold text-ink tracking-[-0.2px]">Object Browser</span>
        </div>

        <div className="p-2 flex flex-col gap-0.5">
          <button
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] font-medium cursor-pointer border-none w-full text-left transition-all duration-150 ease-in-out font-sans ${
              viewMode === "buckets" || viewMode === "objects" ? "bg-primary/12 text-primary" : "bg-transparent text-muted hover:bg-surface-card hover:text-ink"
            }`}
            onClick={handleBackToBuckets}
          >
            <Database size={15} />
            <span>Buckets</span>
            <span
              className={`ml-auto text-[11px] font-semibold px-1.5 rounded-full leading-[18px] ${
                viewMode === "buckets" || viewMode === "objects" ? "bg-primary/15 text-primary" : "bg-surface-card text-muted"
              }`}
            >
              {stats.bucketCount}
            </span>
          </button>
          <button
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] font-medium cursor-pointer border-none w-full text-left transition-all duration-150 ease-in-out font-sans ${
              viewMode === "access-keys" ? "bg-primary/12 text-primary" : "bg-transparent text-muted hover:bg-surface-card hover:text-ink"
            }`}
            onClick={() => setViewMode("access-keys")}
          >
            <Key size={15} />
            <span>Access Keys</span>
          </button>
          <button
            className={`flex items-center gap-2 py-2 px-3 rounded-lg text-[13px] font-medium cursor-pointer border-none w-full text-left transition-all duration-150 ease-in-out font-sans ${
              viewMode === "api-prompt" ? "bg-primary/12 text-primary" : "bg-transparent text-muted hover:bg-surface-card hover:text-ink"
            }`}
            onClick={() => setViewMode("api-prompt")}
          >
            <BookOpen size={15} />
            <span>API & Prompt</span>
          </button>
        </div>

        {/* Summary Stats */}
        <div className="mt-auto p-4 border-t border-hairline flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-medium text-muted-soft uppercase tracking-[0.3px]">Total Objects</span>
            <span className="text-[13px] font-semibold text-ink font-mono">{stats.objectCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-medium text-muted-soft uppercase tracking-[0.3px]">Usage</span>
            <span className="text-[13px] font-semibold text-ink font-mono">{formatBytes(stats.totalSize)}</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-canvas min-w-0">
        {viewMode === "api-prompt" ? (
          <div className="px-4 md:px-8 py-6 max-w-[1200px]">
            <StorageApiDocsPanel />
          </div>
        ) : viewMode === "access-keys" ? (
          <div className="px-4 md:px-8 py-6 max-w-[1200px]">
            <AccessKeysPanel />
          </div>
        ) : viewMode === "buckets" ? (
          <BucketsView
            buckets={buckets}
            onSelectBucket={handleSelectBucket}
            onDeleteBucket={handleDeleteBucket}
            onTogglePublic={handleToggleBucketPublic}
            onCreateBucket={() => setCreateBucketOpen(true)}
            onRefresh={() => {
              fetchBuckets();
              fetchStats();
            }}
          />
        ) : selectedBucket ? (
          <ObjectBrowserView
            bucket={selectedBucket}
            objects={objects}
            commonPrefixes={commonPrefixes}
            loading={objectsLoading}
            searchText={searchText}
            currentPrefix={currentPrefix}
            selectedRowKeys={selectedRowKeys}
            pagination={pagination}
            breadcrumbParts={breadcrumbParts}
            onBack={handleBackToBuckets}
            onSearchChange={(v) => {
              setSearchText(v);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            onNavigatePrefix={navigateToPrefix}
            onSelectedRowKeysChange={setSelectedRowKeys}
            onPaginationChange={(page, limit) => setPagination((p) => ({ ...p, page, limit }))}
            onRefresh={() => {
              fetchObjects();
            }}
            onUpload={() => setUploadModalOpen(true)}
            onBulkDelete={handleBulkDelete}
            onDownload={handleDownload}
            getObjectMenuItems={getObjectMenuItems}
          />
        ) : null}
      </div>

      {/* Modals */}
      <CreateBucketModal
        open={createBucketOpen}
        onClose={() => setCreateBucketOpen(false)}
        onCreated={() => {
          setCreateBucketOpen(false);
          fetchBuckets();
          fetchStats();
        }}
      />

      {selectedBucket && (
        <UploadModal
          open={uploadModalOpen}
          bucketName={selectedBucket.name}
          currentPrefix={currentPrefix}
          onClose={() => setUploadModalOpen(false)}
          onUploaded={() => {
            setUploadModalOpen(false);
            fetchObjects();
            fetchBuckets();
            fetchStats();
          }}
        />
      )}

      {presignModalOpen && selectedBucket && (
        <PresignModal object={presignModalOpen} bucketName={selectedBucket.name} onClose={() => setPresignModalOpen(null)} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  BUCKETS VIEW — Grid of buckets (like MinIO bucket list)
// ══════════════════════════════════════════════════════════════════════════════

function BucketsView({
  buckets,
  onSelectBucket,
  onDeleteBucket,
  onTogglePublic,
  onCreateBucket,
  onRefresh,
}: {
  buckets: Bucket[];
  onSelectBucket: (bucket: Bucket) => void;
  onDeleteBucket: (bucket: Bucket) => void;
  onTogglePublic: (bucket: Bucket) => void;
  onCreateBucket: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="px-4 md:px-8 py-6 max-w-[1200px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="font-display text-xl font-normal text-ink tracking-[-0.3px] m-0">Buckets</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="medium" icon={<RefreshCw size={13} />} onClick={onRefresh} style={{ color: "var(--color-muted)" }}>
            Refresh
          </Button>
          <Button type="primary" size="medium" icon={<Plus size={14} />} onClick={onCreateBucket}>
            Create Bucket
          </Button>
        </div>
      </div>

      {/* Buckets Table */}
      {buckets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-surface-card text-muted-soft mb-4">
            <Database size={40} />
          </div>
          <Text strong style={{ fontSize: 15, color: "var(--color-ink)" }}>
            No buckets created yet
          </Text>
          <Text type="secondary" style={{ marginTop: 4, fontSize: 13 }}>
            Create your first bucket to start storing objects
          </Text>
          <Button type="primary" icon={<Plus size={14} />} onClick={onCreateBucket} style={{ marginTop: 16 }}>
            Create Bucket
          </Button>
        </div>
      ) : (
        <Table
          dataSource={buckets}
          rowKey="id"
          pagination={false}
          className="storage-table"
          onRow={(record) => ({
            onClick: () => onSelectBucket(record),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              key: "name",
              render: (name: string, record: Bucket) => (
                <Space size={10} align="center">
                  <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-primary/8 text-primary shrink-0">
                    <Database size={16} />
                  </div>
                  <Text strong style={{ fontSize: 13, color: "var(--color-ink)" }}>
                    {name}
                  </Text>
                  {record.isPublic ? (
                    <Tag color="green" style={{ fontSize: 10, lineHeight: "16px", margin: 0, padding: "0 6px" }}>
                      <Space size={3} align="center">
                        <Globe size={10} />
                        Public
                      </Space>
                    </Tag>
                  ) : (
                    <Tag style={{ fontSize: 10, lineHeight: "16px", margin: 0, padding: "0 6px", color: "var(--color-muted)" }}>
                      <Space size={3} align="center">
                        <Lock size={10} />
                        Private
                      </Space>
                    </Tag>
                  )}
                </Space>
              ),
            },
            {
              title: "Objects",
              dataIndex: "objectCount",
              key: "objectCount",
              width: 100,
              render: (count: number) => (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {count.toLocaleString()}
                </Text>
              ),
            },
            {
              title: "Size",
              dataIndex: "totalSize",
              key: "totalSize",
              width: 120,
              render: (size: number) => (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {formatBytes(size)}
                </Text>
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
              width: 80,
              render: (_: unknown, record: Bucket) => (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "browse",
                        icon: <FolderOpen size={14} />,
                        label: "Browse",
                        onClick: ({ domEvent }) => {
                          domEvent.stopPropagation();
                          onSelectBucket(record);
                        },
                      },
                      {
                        key: "toggle",
                        icon: record.isPublic ? <Lock size={14} /> : <Globe size={14} />,
                        label: record.isPublic ? "Make Private" : "Make Public",
                        onClick: ({ domEvent }) => {
                          domEvent.stopPropagation();
                          onTogglePublic(record);
                        },
                      },
                      { type: "divider" as const },
                      {
                        key: "delete",
                        icon: <Trash2 size={14} />,
                        label: "Delete Bucket",
                        danger: true,
                        onClick: ({ domEvent }) => {
                          domEvent.stopPropagation();
                          onDeleteBucket(record);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreHorizontal size={14} />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "var(--color-muted)" }}
                  />
                </Dropdown>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  OBJECT BROWSER VIEW — File explorer like MinIO
// ══════════════════════════════════════════════════════════════════════════════

function ObjectBrowserView({
  bucket,
  objects,
  commonPrefixes,
  loading,
  searchText,
  currentPrefix,
  selectedRowKeys,
  pagination,
  breadcrumbParts,
  onBack,
  onSearchChange,
  onNavigatePrefix,
  onSelectedRowKeysChange,
  onPaginationChange,
  onRefresh,
  onUpload,
  onBulkDelete,
  onDownload,
  getObjectMenuItems,
}: {
  bucket: Bucket;
  objects: StorageObject[];
  commonPrefixes: string[];
  loading: boolean;
  searchText: string;
  currentPrefix: string;
  selectedRowKeys: string[];
  pagination: { page: number; limit: number; total: number };
  breadcrumbParts: { label: string; prefix: string }[];
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onNavigatePrefix: (prefix: string) => void;
  onSelectedRowKeysChange: (keys: string[]) => void;
  onPaginationChange: (page: number, limit: number) => void;
  onRefresh: () => void;
  onUpload: () => void;
  onBulkDelete: () => void;
  onDownload: (obj: StorageObject) => void;
  getObjectMenuItems: (obj: StorageObject) => MenuProps["items"];
}) {
  // Combine folders + files into one list
  type BrowserRow = { type: "folder"; key: string; name: string } | { type: "file"; data: StorageObject };

  const rows: BrowserRow[] = useMemo(() => {
    const folders: BrowserRow[] = commonPrefixes.map((prefix) => ({
      type: "folder" as const,
      key: prefix,
      name: prefix.slice(currentPrefix.length).replace(/\/$/, ""),
    }));
    const files: BrowserRow[] = objects.map((obj) => ({
      type: "file" as const,
      key: obj.id,
      data: obj,
    }));
    return [...folders, ...files];
  }, [commonPrefixes, objects, currentPrefix]);

  const objectColumns: ColumnsType<BrowserRow> = [
    {
      title: "Name",
      key: "name",
      render: (_: unknown, record: BrowserRow) => {
        if (record.type === "folder") {
          return (
            <Space size={8} align="center" style={{ cursor: "pointer" }} onClick={() => onNavigatePrefix(record.key)}>
              <FolderClosed size={16} style={{ color: "var(--color-accent-amber)" }} />
              <Text strong style={{ fontSize: 13, color: "var(--color-ink)" }}>
                {record.name}/
              </Text>
            </Space>
          );
        }
        const fileName = record.data.key.slice(currentPrefix.length);
        return (
          <Space size={8} align="center">
            <span style={{ color: "var(--color-muted-soft)", display: "inline-flex" }}>{getFileIcon(record.data.contentType)}</span>
            <Text style={{ fontSize: 13, color: "var(--color-body-strong)" }}>{fileName}</Text>
            {record.data.isPublic && (
              <Tooltip title="Public">
                <Globe size={11} style={{ color: "var(--color-success)" }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Size",
      key: "size",
      width: 100,
      render: (_: unknown, record: BrowserRow) => {
        if (record.type === "folder")
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Text>
          );
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatBytes(record.data.size)}
          </Text>
        );
      },
    },
    {
      title: "Type",
      key: "type",
      width: 150,
      render: (_: unknown, record: BrowserRow) => {
        if (record.type === "folder")
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Folder
            </Text>
          );
        return (
          <Tag color={getContentTypeColor(record.data.contentType)} style={{ fontSize: 11, margin: 0 }}>
            {record.data.contentType.length > 22 ? record.data.contentType.slice(0, 22) + "…" : record.data.contentType}
          </Tag>
        );
      },
    },
    {
      title: "Last Modified",
      key: "modified",
      width: 170,
      render: (_: unknown, record: BrowserRow) => {
        if (record.type === "folder") return null;
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDate(record.data.updatedAt)}
          </Text>
        );
      },
    },
    {
      title: "",
      key: "actions",
      align: "right" as const,
      width: 90,
      render: (_: unknown, record: BrowserRow) => {
        if (record.type === "folder") {
          return (
            <Button
              type="text"
              size="small"
              icon={<ChevronRight size={14} />}
              onClick={() => onNavigatePrefix(record.key)}
              style={{ color: "var(--color-muted)" }}
            />
          );
        }
        return (
          <Space size={2}>
            <Tooltip title="Download">
              <Button type="text" size="small" icon={<Download size={13} />} onClick={() => onDownload(record.data)} style={{ color: "var(--color-muted)" }} />
            </Tooltip>
            <Dropdown menu={{ items: getObjectMenuItems(record.data) }} trigger={["click"]}>
              <Button type="text" size="small" icon={<MoreHorizontal size={13} />} style={{ color: "var(--color-muted)" }} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1200px]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-soft border border-hairline-soft rounded-lg mb-4">
        <Tooltip title="Back to Buckets">
          <button
            className="flex items-center justify-center w-7 h-7 rounded-sm border border-hairline bg-canvas text-muted cursor-pointer transition-all duration-150 ease-in-out shrink-0 hover:bg-surface-card hover:text-ink"
            onClick={onBack}
          >
            <ArrowLeft size={15} />
          </button>
        </Tooltip>
        <Breadcrumb
          items={[
            {
              title: (
                <a
                  onClick={() => onNavigatePrefix("")}
                  className="text-[13px] font-medium text-body-strong cursor-pointer inline-flex items-center hover:text-primary transition-colors duration-150"
                >
                  <Space size={4} align="center">
                    <Database size={13} />
                    {bucket.name}
                  </Space>
                </a>
              ),
            },
            ...breadcrumbParts.map((part) => ({
              title: (
                <a
                  onClick={() => onNavigatePrefix(part.prefix)}
                  className="text-[13px] font-medium text-body-strong cursor-pointer inline-flex items-center hover:text-primary transition-colors duration-150"
                >
                  {part.label}
                </a>
              ),
            })),
          ]}
        />
        {bucket.isPublic && (
          <Tag color="green" style={{ fontSize: 10, lineHeight: "16px", margin: 0, marginLeft: 8, padding: "0 6px" }}>
            <Space size={3} align="center">
              <Globe size={10} />
              Public
            </Space>
          </Tag>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            placeholder="Search objects…"
            prefix={<Search size={13} style={{ color: "var(--color-muted-soft)" }} />}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
            size="small"
            style={{ width: 240 }}
          />
          {selectedRowKeys.length > 0 && (
            <Button danger size="small" icon={<Trash2 size={13} />} onClick={onBulkDelete}>
              Delete ({selectedRowKeys.length})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="small" icon={<RefreshCw size={13} />} onClick={onRefresh} style={{ color: "var(--color-muted)" }}>
            Refresh
          </Button>
          <Button type="primary" size="small" icon={<UploadIcon size={13} />} onClick={onUpload}>
            Upload
          </Button>
        </div>
      </div>

      {/* Objects Table */}
      <Table
        columns={objectColumns}
        dataSource={rows}
        rowKey="key"
        loading={loading}
        className="storage-table"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => onSelectedRowKeysChange(keys as string[]),
          getCheckboxProps: (record) => ({
            disabled: record.type === "folder",
          }),
        }}
        pagination={
          pagination.total > pagination.limit
            ? {
                current: pagination.page,
                pageSize: pagination.limit,
                total: pagination.total,
                showSizeChanger: true,
                size: "small",
                showTotal: (total) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {total} object(s)
                  </Text>
                ),
                onChange: (page, pageSize) => onPaginationChange(page, pageSize),
              }
            : false
        }
        locale={{
          emptyText: (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-surface-card text-muted-soft mb-4">
                <Layers size={32} />
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {currentPrefix ? "No objects in this prefix" : "This bucket is empty"}
              </Text>
              <Button type="primary" size="small" icon={<UploadIcon size={13} />} onClick={onUpload} style={{ marginTop: 12 }}>
                Upload Files
              </Button>
            </div>
          ),
        }}
        size="small"
      />
    </div>
  );
}

// ── Create Bucket Modal ─────────────────────────────────────────────────────────

function CreateBucketModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form] = Form.useForm<CreateBucketInput>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: CreateBucketInput) => {
    setLoading(true);
    try {
      await client.storage.createBucket(values);
      message.success("Bucket created");
      onCreated();
      form.resetFields();
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to create bucket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create Bucket" open={open} onCancel={onClose} footer={null} destroyOnHidden width={460}>
      <Form<CreateBucketInput>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={{ isPublic: false }}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="name"
          label="Bucket Name"
          rules={[
            { required: true, message: "Name is required" },
            { min: 3, max: 63, message: "3-63 characters" },
            { pattern: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, message: "Only lowercase alphanumeric + hyphens" },
          ]}
          extra="Lowercase alphanumeric and hyphens only, 3-63 characters"
        >
          <Input autoFocus placeholder="my-bucket" style={{ fontFamily: "var(--font-mono)" }} />
        </Form.Item>

        <Form.Item name="isPublic" label="Public Access" valuePropName="checked">
          <Switch checkedChildren={<Globe size={12} />} unCheckedChildren={<Lock size={12} />} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ float: "right" }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Bucket
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Upload Modal ────────────────────────────────────────────────────────────────

function UploadModal({
  open,
  bucketName,
  currentPrefix,
  onClose,
  onUploaded,
}: {
  open: boolean;
  bucketName: string;
  currentPrefix: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleUpload = async () => {
    if (fileList.length === 0) return;
    setUploading(true);
    setProgress(0);

    let uploaded = 0;
    const total = fileList.length;

    try {
      for (const file of fileList) {
        const rawFile = file.originFileObj;
        if (!rawFile) continue;
        const key = currentPrefix + rawFile.name;
        await client.storage.upload(bucketName, key, rawFile);
        uploaded++;
        setProgress(Math.round((uploaded / total) * 100));
      }
      message.success(`${uploaded} file(s) uploaded`);
      setFileList([]);
      onUploaded();
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UploadIcon size={18} />
          Upload Files
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      <div style={{ marginTop: 16 }}>
        {currentPrefix && (
          <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
            Upload to: <Text code>{currentPrefix}</Text>
          </Text>
        )}

        <Upload.Dragger
          multiple
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          beforeUpload={() => false}
          disabled={uploading}
          style={{ borderRadius: 12 }}
        >
          <p className="ant-upload-drag-icon">
            <UploadIcon size={32} style={{ color: "var(--color-primary)" }} />
          </p>
          <p className="ant-upload-text">Click or drag files to upload</p>
          <p className="ant-upload-hint">Support single or bulk upload</p>
        </Upload.Dragger>

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={progress} status="active" strokeColor="var(--color-primary)" />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
          <Button onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleUpload} loading={uploading} disabled={fileList.length === 0} icon={<UploadIcon size={14} />}>
            Upload {fileList.length > 0 ? `(${fileList.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Presign URL Modal ───────────────────────────────────────────────────────────

function PresignModal({
  object,
  bucketName,
  onClose,
}: {
  object: StorageObject;
  bucketName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(3600);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await client.storage.presignUrl(bucketName, object.key, expiresIn);
      setUrl(result.url);
    } catch (err) {
      if (err instanceof GomuStackError) message.error(err.message);
      else message.error("Failed to generate presigned URL");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      message.success("URL copied to clipboard");
    } catch {
      message.error("Failed to copy");
    }
  };

  const fileName = object.key.split("/").pop() ?? object.key;

  return (
    <Modal
      title={
        <Space>
          <Link size={18} />
          Get Presigned URL
        </Space>
      }
      open
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={520}
    >
      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          File: <Text strong>{fileName}</Text>
        </Text>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 13 }}>Expires in:</Text>
          <InputNumber value={expiresIn} onChange={(v) => setExpiresIn(v ?? 3600)} min={1} max={604800} addonAfter="seconds" style={{ width: 200 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({Math.floor(expiresIn / 3600)}h {Math.floor((expiresIn % 3600) / 60)}m)
          </Text>
        </div>

        {!url && (
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={handleGenerate} loading={loading} icon={<Link size={14} />}>
              Generate URL
            </Button>
          </div>
        )}

        {url && (
          <div style={{ marginTop: 16 }}>
            <Input.TextArea value={url} readOnly rows={3} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button icon={<Copy size={14} />} onClick={handleCopy}>
                Copy URL
              </Button>
              <Button icon={<ExternalLink size={14} />} onClick={() => window.open(url, "_blank")}>
                Open in Browser
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
