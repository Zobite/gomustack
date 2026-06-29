import { Button, Input, Table, Tooltip } from "antd";
import { BookOpen, Cpu, ExternalLink, Globe, Laptop, Layers, MemoryStick, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BrowserProfileItem } from "src/lib/resources/browser";
import { getFingerprintSummary, getProxyDisplay } from "./common/utils";
import BrowserDocsModal from "./components/BrowserDocsModal";
import { ProfileModal } from "./components/ProfileModal";
import { useBrowserProfiles } from "./hooks/useBrowserProfiles";

// ══════════════════════════════════════════════════════════════════════════════
//  BROWSER PROFILES PAGE — Monitoring dashboard for LLM-driven browsers
// ══════════════════════════════════════════════════════════════════════════════

export default function BrowserProfilesPage() {
  const {
    profiles,
    loading,
    total,
    page,
    limit,
    search,
    modalOpen,
    editingProfile,
    actionLoading,
    profileTabs,
    setPage,
    setLimit,
    setSearch,
    setModalOpen,
    setEditingProfile,
    handleDelete,
    handleSubmit,
  } = useBrowserProfiles();

  const [docsOpen, setDocsOpen] = useState(false);
  const activeCount = profiles.filter((p) => p.status === "running").length;

  const columns = [
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Profile</span>,
      key: "name",
      render: (_: unknown, record: BrowserProfileItem) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink text-[13px] leading-tight">{record.name}</span>
          {record.description && <span className="text-[11px] text-muted-soft mt-0.5 max-w-[240px] truncate block">{record.description}</span>}
        </div>
      ),
    },
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Status</span>,
      key: "status",
      width: 100,
      render: (_: unknown, record: BrowserProfileItem) => {
        if (record.status === "running") {
          return (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-success">Active</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-soft shrink-0" />
            <span className="text-[11px] font-medium text-muted">Idle</span>
          </div>
        );
      },
    },
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Tabs</span>,
      key: "tabCount",
      width: 80,
      render: (_: unknown, record: BrowserProfileItem) => {
        if (record.status !== "running") {
          return <span className="text-[11px] text-muted-soft">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-muted-soft shrink-0" />
            <span className="font-mono text-[11px] text-muted">{record.tabCount || 0}</span>
          </div>
        );
      },
    },
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Memory</span>,
      key: "memoryMB",
      width: 100,
      render: (_: unknown, record: BrowserProfileItem) => {
        if (record.status !== "running") {
          return <span className="text-[11px] text-muted-soft">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <MemoryStick size={11} className="text-muted-soft shrink-0" />
            <span className="font-mono text-[11px] text-muted">{record.memoryMB || 0} MB</span>
          </div>
        );
      },
    },
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Proxy</span>,
      key: "proxy",
      render: (_: unknown, record: BrowserProfileItem) => {
        const display = getProxyDisplay(record.proxyConfig);
        const isDirect = display === "Direct";
        return <span className={`font-mono text-[11px] ${isDirect ? "text-muted-soft" : "text-muted"}`}>{display}</span>;
      },
    },
    {
      title: <span className="font-mono text-[10px] uppercase tracking-wider">Fingerprint</span>,
      key: "fingerprint",
      render: (_: unknown, record: BrowserProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Laptop size={11} className="text-muted-soft shrink-0" />
          <span className="font-mono text-[11px] text-muted">{getFingerprintSummary(record.fingerprintConfig)}</span>
        </div>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_: unknown, record: BrowserProfileItem) => (
        <div className="flex items-center justify-end gap-1">
          {record.status === "idle" && (
            <Tooltip title="Edit profile">
              <Button
                type="text"
                size="small"
                icon={<Settings size={13} />}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProfile(record);
                  setModalOpen(true);
                }}
                className="text-muted hover:text-ink"
              />
            </Tooltip>
          )}
          <Tooltip title="Delete profile">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(record.id, record.name);
              }}
              className="text-muted hover:text-error"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* Header */}
      <div className="px-8 pt-10 pb-6 shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-muted" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Automation / Browsers</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[24px] md:text-[32px] font-normal text-ink tracking-[-0.64px] m-0 leading-tight">Browser Profiles</h1>
            <p className="text-[13px] text-muted mt-2 m-0 leading-relaxed max-w-[520px]">
              Isolated browser sessions with unique fingerprints and proxy routing. LLM agents launch and control browsers via API. Idle sessions auto-stop
              after 5 minutes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setDocsOpen(true)}
              className="flex items-center gap-1.5 h-[36px] px-4 rounded-md bg-transparent border border-hairline hover:bg-surface-card text-ink font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              <BookOpen size={14} />
              Connect LLM
            </button>
            <Button
              type="primary"
              onClick={() => {
                setEditingProfile(null);
                setModalOpen(true);
              }}
              icon={<Plus size={14} />}
              className="bg-ink hover:bg-primary-active border-none font-mono text-[11px] uppercase tracking-wider h-[36px]"
            >
              Add Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Input
          placeholder="Search by name…"
          prefix={<Search size={14} style={{ color: "var(--color-muted-soft)" }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
          allowClear
        />

        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-soft">
          <Cpu size={12} />
          <span>{activeCount} Active</span>
          <span className="text-hairline-strong mx-1">·</span>
          <span>{total} Total</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 mx-8 mb-4 border border-hairline rounded-lg overflow-hidden bg-surface-card">
        <Table
          dataSource={profiles}
          columns={columns}
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowRender: (record: BrowserProfileItem) => {
              if (record.status !== "running") return null;
              const tabs = profileTabs[record.id] || [];
              if (tabs.length === 0) {
                return <span className="font-mono text-[11px] text-muted-soft italic">No open tabs</span>;
              }
              return (
                <div className="flex flex-col gap-1.5 py-1">
                  {tabs.map((tab) => (
                    <div key={tab.index} className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-muted bg-canvas border border-hairline px-1.5 py-0.5 rounded shrink-0">{tab.index + 1}</span>
                      <span className="text-[12px] text-ink truncate max-w-[260px]">{tab.title || "Untitled"}</span>
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-ink font-mono text-[10px] truncate flex-1 flex items-center gap-1"
                      >
                        {tab.url}
                        <ExternalLink size={9} className="shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            },
            rowExpandable: (record: BrowserProfileItem) => record.status === "running",
          }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p, l) => {
              setPage(p);
              setLimit(l);
            },
            showSizeChanger: true,
            hideOnSinglePage: true,
            className: "px-4 font-mono text-[11px]",
          }}
          locale={{
            emptyText: (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Globe size={32} strokeWidth={1.2} className="text-muted-soft mb-3" />
                <span className="font-mono text-[12px] uppercase tracking-wider font-semibold text-muted">No Profiles</span>
                <p className="text-[13px] text-muted-soft mt-2 max-w-[300px] leading-relaxed">
                  Create a browser profile with proxy and fingerprint settings. LLM agents will launch and operate them automatically.
                </p>
                <Button
                  type="primary"
                  icon={<Plus size={14} />}
                  onClick={() => {
                    setEditingProfile(null);
                    setModalOpen(true);
                  }}
                  className="bg-ink hover:bg-primary-active border-none font-mono text-[11px] uppercase tracking-wider mt-4"
                >
                  Create First Profile
                </Button>
              </div>
            ),
          }}
        />
      </div>

      {/* Modal */}
      <ProfileModal
        open={modalOpen}
        editingProfile={editingProfile}
        loading={actionLoading}
        onCancel={() => {
          setModalOpen(false);
          setEditingProfile(null);
        }}
        onSubmit={handleSubmit}
      />

      <BrowserDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} profiles={profiles} />
    </div>
  );
}
