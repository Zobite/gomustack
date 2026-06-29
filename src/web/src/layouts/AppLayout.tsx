import { Tooltip } from "antd";
import {
  BookOpen,
  Bot,
  Cpu,
  Database,
  FileText,
  Globe,
  HardDrive,
  Key,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Plug,
  Settings,
  Table2,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { GomuStackLogo } from "src/common/components/GomuStackLogo";
import { useAuthStore } from "src/common/stores/auth.store";
import { client } from "src/lib/client";
import { adminNavItems, mainNavItems } from "src/router";
import { useShallow } from "zustand/react/shallow";

const navIcons: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={16} strokeWidth={2} />,
  users: <Users size={16} strokeWidth={2} />,
  agents: <Bot size={16} strokeWidth={2} />,
  settings: <Settings size={16} strokeWidth={2} />,
  "key-round": <KeyRound size={16} strokeWidth={2} />,
  "book-open": <BookOpen size={16} strokeWidth={2} />,
  "file-text": <FileText size={16} strokeWidth={2} />,
  "table-2": <Table2 size={16} strokeWidth={2} />,
  key: <Key size={16} strokeWidth={2} />,
  "hard-drive": <HardDrive size={16} strokeWidth={2} />,
  database: <Database size={16} strokeWidth={2} />,
  plug: <Plug size={16} strokeWidth={2} />,
  zap: <Zap size={16} strokeWidth={2} />,
  globe: <Globe size={16} strokeWidth={2} />,
  monitor: <Monitor size={16} strokeWidth={2} />,
  cpu: <Cpu size={16} strokeWidth={2} />,
};

type NavItem = {
  label: string;
  icon: string;
  path: string;
  requiredRole?: readonly string[];
};

function NavGroup({
  label,
  items,
  userRole,
}: {
  label?: string;
  items: NavItem[];
  userRole: string;
}) {
  const visibleItems = items.filter((item) => {
    if (!item.requiredRole || item.requiredRole.length === 0) return true;
    return item.requiredRole.includes(userRole);
  });

  if (visibleItems.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mb-6">
      {label && (
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.8px] text-muted-soft px-3 mb-1 select-none hidden md:block">{label}</div>
      )}
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 py-2 px-3 rounded-md text-[13px] font-medium no-underline transition-colors duration-150 cursor-pointer justify-center md:justify-start border ${
              isActive
                ? "bg-[rgba(38,37,30,0.04)] !text-ink border-hairline"
                : "bg-transparent !text-muted hover:bg-surface-card hover:!text-ink border-transparent hover:border-hairline-soft"
            }`
          }
        >
          <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
            {navIcons[item.icon] ?? <LayoutDashboard size={16} strokeWidth={2} />}
          </span>
          <span className="hidden md:inline">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const navigate = useNavigate();

  const handleLogout = () => {
    client.auth.logout();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    logout();
    navigate("/login");
  };

  const userRole = user?.role ?? "";
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    client.system.getVersion().then((v) => setVersion(v.version)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="w-[64px] md:w-[260px] min-w-[64px] md:min-w-[260px] shrink-0 bg-surface-soft border-r border-hairline flex flex-col transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10">
        {/* App Header */}
        <div className="flex flex-col gap-1 p-4 md:px-6 md:py-6 border-b border-hairline">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <span className="inline-flex items-center justify-center w-8 h-8 shrink-0 text-ink">
              <GomuStackLogo className="w-full h-full" />
            </span>
            <div className="flex-col min-w-0 hidden md:flex">
              <span className="font-display font-medium text-[15px] tracking-[-0.2px] text-ink leading-tight">GomuStack</span>
              <span className="font-mono text-[10px] text-muted-soft tracking-[0.5px] mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {version ? `v${version}` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          <NavGroup items={mainNavItems} userRole={userRole} />
          <div className="flex-1 min-h-[16px]" />
          <NavGroup label="Administration" items={adminNavItems} userRole={userRole} />
        </nav>

        {/* User Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-hairline justify-center md:justify-start bg-canvas">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-transparent border border-hairline-strong text-ink flex items-center justify-center font-mono text-[14px] shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-col min-w-0 hidden md:flex">
              <span className="text-[13px] font-medium text-ink overflow-hidden text-ellipsis whitespace-nowrap leading-tight">{user?.name}</span>
              <span className="font-mono text-[10px] text-muted-soft uppercase tracking-wide">Role: {userRole}</span>
            </div>
          </div>
          <Tooltip title="Disconnect">
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:inline-flex items-center justify-center w-8 h-8 bg-surface-card border border-hairline rounded-md text-muted cursor-pointer transition-colors duration-150 hover:text-error hover:border-[var(--color-error)] hover:bg-[#cf2d561a]"
            >
              <LogOut size={14} />
            </button>
          </Tooltip>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-canvas relative">
        <Outlet />
      </main>
    </div>
  );
}
