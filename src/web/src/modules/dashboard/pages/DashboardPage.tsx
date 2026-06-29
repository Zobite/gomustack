import { ArrowRight, Braces, Database, HardDrive, KeyRound, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "src/common/stores/auth.store";

const NAV_ITEMS = [
  { icon: Braces, title: "KV Store", desc: "Key-value store", path: "/kv-store" },
  { icon: Database, title: "DataTables", desc: "Projects, tables & records", path: "/datatables" },
  { icon: HardDrive, title: "Object Storage", desc: "Buckets & files", path: "/storage" },
  { icon: KeyRound, title: "API Keys", desc: "Manage credentials", path: "/api-keys" },
  { icon: Terminal, title: "MCP Servers", desc: "Tool servers", path: "/mcp-servers" },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const greeting = getGreeting();

  return (
    <div className="max-w-[900px] mx-auto px-8 py-12 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 border-b border-hairline pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={18} className="text-muted" />
          <span className="font-mono text-[13px] text-muted tracking-wide uppercase">Dashboard</span>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[36px] font-normal tracking-[-0.72px] text-ink leading-tight">
            {greeting}, {user?.name}
          </h2>
          <div className="font-mono text-[13px] text-muted-soft flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" />
            Operational
          </div>
        </div>
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            className="p-5 rounded-[12px] border border-hairline bg-surface-card hover:bg-canvas-soft hover:border-hairline-strong transition-all cursor-pointer flex items-center gap-4 group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-canvas border border-hairline-soft text-muted group-hover:text-ink transition-colors">
              <item.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-ink">{item.title}</div>
              <div className="text-[12px] text-muted-soft">{item.desc}</div>
            </div>
            <ArrowRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
