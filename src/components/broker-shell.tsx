import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { getCurrentUser, logout } from "@/lib/auth";
import {
  LayoutDashboard, Users, ShieldCheck, FileCheck2,
  ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  CircleUser, Clock, Sun, Moon, Bell, Check, LogOut,
  ClipboardList, Settings2, Search,
} from "lucide-react";

// ─── Broker nav — scoped subset of the admin nav ───────────────────────────────

export type NavChild = { label: string; href?: string; badge?: string | number };
export type NavGroup = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  section: string;
  badge?: string | number;
  children?: NavChild[];
};

export const brokerNav: NavGroup[] = [
  // ── OVERVIEW ──
  { section: "OVERVIEW", icon: LayoutDashboard, label: "Overview", href: "/broker" },

  // ── CLIENTS ──
  {
    section: "CLIENTS", icon: Users, label: "User Management", href: "/users", badge: 12,
    children: [
      { label: "All Users",         href: "/users" },
      { label: "Login History",     href: "/users?tab=logins" },
      { label: "Linked Banks",      href: "/users?tab=banks" },
      { label: "Activity Timeline", href: "/users?tab=activity" },
      { label: "Export" },
    ],
  },
  {
    section: "CLIENTS", icon: ShieldCheck, label: "Auth & Security",
    children: [
      { label: "Active Sessions" }, { label: "Force Logout" },
      { label: "Password Resets" }, { label: "PIN Resets" },
      { label: "Biometric Status" }, { label: "MFA" },
      { label: "Failed Logins", badge: 38 }, { label: "Lockouts", badge: 6 },
      { label: "IP Blacklist" }, { label: "Device Blacklist" },
    ],
  },
  { section: "CLIENTS", icon: FileCheck2, label: "KYC Management", href: "/kyc", badge: 2 },

  // ── TRADING ──
  { section: "TRADING", icon: ClipboardList, label: "Orders", href: "/orders" },

  // ── ACCOUNT ──
  { section: "ACCOUNT", icon: Settings2, label: "Settings", href: "/settings" },
];

export const brokerSectionOrder = ["OVERVIEW", "CLIENTS", "TRADING", "ACCOUNT"];

const BROKER_NOTIF_COUNT = 5;

const TIME_RANGES = [
  { label: "Last 1 hour",   value: "1h",  short: "Last 1h"  },
  { label: "Last 6 hours",  value: "6h",  short: "Last 6h"  },
  { label: "Last 12 hours", value: "12h", short: "Last 12h" },
  { label: "Last 24 hours", value: "24h", short: "Last 24h" },
  { label: "Last 7 days",   value: "7d",  short: "Last 7d"  },
  { label: "Last 30 days",  value: "30d", short: "Last 30d" },
  { label: "Last 90 days",  value: "90d", short: "Last 90d" },
];

// ─── BrokerShell ───────────────────────────────────────────────────────────────

export function BrokerShell({
  activeLabel,
  title,
  children,
}: {
  activeLabel: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ [activeLabel]: true });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("pine-broker-sidebar-collapsed") === "1");
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem("pine-broker-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <BrokerSidebar
        open={open}
        setOpen={setOpen}
        activeLabel={activeLabel}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <BrokerTopbar title={title} />
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-10 space-y-6 scrollbar-thin-gray">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function BrokerSidebar({
  open, setOpen, activeLabel, collapsed, onToggleCollapse,
}: {
  open: Record<string, boolean>;
  setOpen: (v: Record<string, boolean>) => void;
  activeLabel: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside
      className="relative shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-visible"
      style={{ width: collapsed ? "4.5rem" : "17rem" }}
    >
      {/* Header */}
      <div className="relative z-10 flex items-center h-16 px-3 shrink-0">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-foreground leading-none">Pine</div>
            <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">BROKER PORTAL</div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${collapsed ? "mx-auto" : "ml-auto"}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronsRight className="w-4 h-4" />
            : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-3">
        {brokerSectionOrder.map((section, sectionIdx) => {
          const items = brokerNav.filter((n) => n.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className={sectionIdx > 0 ? "mt-1" : ""}>
              {/* Section divider + label */}
              {sectionIdx > 0 && (
                <div className={`mx-4 mb-2 ${collapsed ? "" : ""}`}>
                  <div className="border-t border-sidebar-border" />
                </div>
              )}
              {!collapsed && (
                <div className="px-4 pb-1 pt-1">
                  <span className="text-[9px] font-semibold tracking-[0.16em] text-muted-foreground">
                    {section}
                  </span>
                </div>
              )}
              <ul className="px-2 space-y-px">
                {items.map((item) => (
                  <BrokerNavItem
                    key={item.label}
                    item={item}
                    active={item.label === activeLabel}
                    isOpen={!!open[item.label]}
                    onToggle={() => setOpen({ ...open, [item.label]: !open[item.label] })}
                    collapsed={collapsed}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <UserFooter collapsed={collapsed} />
      </div>
    </aside>
  );
}

function UserFooter({ collapsed }: { collapsed: boolean }) {
  const user = getCurrentUser();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Broker';
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'BROKER';
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'B';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className={`w-full flex items-center rounded-[6px] px-2 py-2 hover:bg-muted cursor-pointer transition-colors ${collapsed ? "justify-center" : "gap-2.5"}`}
      >
        <div className="w-8 h-8 shrink-0 rounded-full bg-pine/10 flex items-center justify-center ring-1 ring-pine/20">
          <span className="text-[11px] font-bold text-pine">{initials}</span>
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[13px] font-medium text-foreground leading-none truncate">{displayName}</div>
              <div className="text-[9px] tracking-[0.1em] text-muted-foreground mt-0.5 truncate">{roleLabel}</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {menuOpen && (
        <div className={`absolute ${collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0 right-0'} z-50 bg-card border border-border rounded-[4px] shadow-xl overflow-hidden`}>
          <div className="px-3.5 py-3 border-b border-border">
            <div className="text-[13px] font-medium text-foreground">{displayName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{user?.email ?? ''}</div>
          </div>
          <Link
            to="/settings"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-foreground hover:bg-muted/60 transition-colors text-left"
          >
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-rose-500 hover:bg-rose-500/5 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function BrokerNavItem({
  item, active, isOpen, onToggle, collapsed,
}: {
  item: NavGroup; active: boolean; isOpen: boolean; onToggle: () => void; collapsed: boolean;
}) {
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const liRef = useRef<HTMLLIElement>(null);
  const [flyoutTop, setFlyoutTop] = useState<number | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = () => {
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null; }
  };
  const scheduleHide = () => {
    cancelHide();
    setFlyoutTop(null);
  };

  /* ── Collapsed: icon only + portal flyout ── */
  if (collapsed) {
    const cls = `relative w-full flex items-center justify-center p-2.5 rounded-[4px] transition-colors ${active ? "bg-pine/10" : "hover:bg-muted"}`;
    const flyout = flyoutTop !== null
      ? createPortal(
          <div
            className="fixed z-[200] pl-2"
            style={{ top: flyoutTop, left: "4.5rem" }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <div className="bg-card rounded-[4px] shadow-xl border border-border min-w-[192px] overflow-hidden">
              <div className={`px-3.5 py-2.5 flex items-center gap-2.5 border-b ${active ? "border-pine/20 bg-pine/5" : "border-border"}`}>
                <div className={`w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0 ${active ? "bg-pine/15" : "bg-muted"}`}>
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-pine" : "text-muted-foreground"}`} />
                </div>
                <span className={`text-[12px] font-semibold leading-none ${active ? "text-pine" : "text-foreground"}`}>{item.label}</span>
                {item.badge != null && (
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-pine/10 text-pine leading-none shrink-0">{item.badge}</span>
                )}
              </div>
              {hasChildren ? (
                <ul className="py-1 max-h-72 overflow-y-auto scrollbar-thin-gray">
                  {item.children!.map((c) => (
                    <li key={c.label}>
                      <Link
                        to={c.href ?? "/coming-soon"}
                        className="w-full flex items-center gap-2 px-3.5 py-[7px] text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left"
                      >
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.badge != null && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-pine/10 text-pine leading-none shrink-0">{c.badge}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3.5 py-2.5 text-[12px] text-muted-foreground">{item.label}</div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

    return (
      <li
        ref={liRef}
        onMouseEnter={() => { cancelHide(); const r = liRef.current?.getBoundingClientRect(); if (r) setFlyoutTop(r.top); }}
        onMouseLeave={scheduleHide}
      >
        <div className="relative">
          {item.href
            ? <Link to={item.href} className={cls}><Icon className={`w-[18px] h-[18px] ${active ? "text-pine" : "text-muted-foreground"}`} /></Link>
            : <button className={cls}><Icon className={`w-[18px] h-[18px] ${active ? "text-pine" : "text-muted-foreground"}`} /></button>}
          {item.badge != null && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pine" />}
        </div>
        {flyout}
      </li>
    );
  }

  /* ── Expanded: icon + label with left-border active indicator ── */
  const rowCls = `relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[13px] font-[450] transition-colors ${
    active
      ? "bg-pine/8 text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;

  const activeIndicator = active
    ? <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-pine" />
    : null;

  const rowContent = (icon: React.ReactNode, label: string, badge?: string | number, chevron?: React.ReactNode) => (
    <>
      {activeIndicator}
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${active ? "bg-pine/15 text-pine" : "bg-muted text-muted-foreground"}`}>
          {badge}
        </span>
      )}
      {chevron}
    </>
  );

  return (
    <li>
      {hasChildren ? (
        <button onClick={onToggle} className={rowCls}>
          {rowContent(
            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-pine" : "text-muted-foreground"}`} />,
            item.label, item.badge,
            isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />,
          )}
        </button>
      ) : item.href ? (
        <Link to={item.href} className={rowCls}>
          {rowContent(<Icon className={`w-4 h-4 shrink-0 ${active ? "text-pine" : "text-muted-foreground"}`} />, item.label, item.badge)}
        </Link>
      ) : (
        <button className={rowCls}>
          {rowContent(<Icon className="w-4 h-4 shrink-0 text-muted-foreground" />, item.label, item.badge)}
        </button>
      )}

      {hasChildren && isOpen && (
        <ul className="mt-1 ml-4 space-y-0.5 pb-1">
          {item.children!.map((c, idx) => {
            const isLast = idx === item.children!.length - 1;
            return (
              <li key={c.label} className="relative pl-[26px]">
                <div className="pointer-events-none absolute left-[5px] top-0 h-[calc(50%+1px)] w-[14px] border-l-[1.5px] border-b-[1.5px] border-border rounded-bl-[4px]" />
                {!isLast && <div className="pointer-events-none absolute left-[5px] top-1/2 bottom-0 w-[1.5px] bg-border" />}
                <Link
                  to={c.href ?? "/coming-soon"}
                  className="w-full flex items-center gap-2 pr-2 py-[7px] text-[12px] transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-[3px] text-left"
                >
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.badge != null && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none shrink-0">{c.badge}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function BrokerTopbar({ title }: { title: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState("24h");
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rangeOpen) return;
    const handler = (e: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) setRangeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rangeOpen]);

  useEffect(() => {
    const stored = localStorage.getItem("pine-theme");
    const initialDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initialDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (dark) { root.classList.add("dark"); localStorage.setItem("pine-theme", "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem("pine-theme", "light"); }
  }, [dark, mounted]);

  return (
    <header className="flex items-center gap-4 px-8 py-4 bg-background sticky top-0 z-10 border-b border-border">
      <div className="shrink-0 min-w-0">
        <div className="text-lg font-semibold">{title}</div>
      </div>
      <div className="flex-1 min-w-0 mx-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients, orders, KYC, support…"
            className="w-full h-10 pl-11 pr-4 rounded-[4px] bg-muted/60 border border-transparent focus:outline-none focus:border-pine/40 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Time range picker */}
        <div ref={rangeRef} className="relative hidden md:block">
          <button
            onClick={() => setRangeOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-[4px] border text-sm transition-colors ${
              rangeOpen ? "border-pine/40 bg-pine/5 text-pine" : "border-border hover:bg-muted/40 text-foreground"
            }`}
          >
            <Clock className={`w-4 h-4 ${rangeOpen ? "text-pine" : "text-muted-foreground"}`} />
            {TIME_RANGES.find((r) => r.value === range)?.short ?? "Last 24h"}
            <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-150 ${rangeOpen ? "rotate-180" : ""}`} />
          </button>
          {rangeOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-card border border-border rounded-[4px] shadow-xl overflow-hidden">
              <div className="px-3.5 pt-3 pb-2">
                <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">TIME RANGE</span>
              </div>
              <div className="pb-2">
                {TIME_RANGES.map((r) => {
                  const selected = range === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => { setRange(r.value); setRangeOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-[7px] text-[13px] transition-colors text-left ${
                        selected ? "bg-pine/6 text-pine font-medium" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected ? "bg-pine" : "bg-border"}`} />
                      <span className="flex-1">{r.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-pine shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="px-3.5 py-2.5 border-t border-border bg-muted/30">
                <p className="text-[11px] text-muted-foreground">Applies to all dashboard metrics</p>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setDark((d) => !d)}
          className="w-10 h-10 rounded-[4px] bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Notifications */}
        <Link
          to="/notifications"
          className="w-10 h-10 rounded-[4px] bg-muted/60 flex items-center justify-center relative hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {BROKER_NOTIF_COUNT}
          </span>
        </Link>
      </div>
    </header>
  );
}

// ─── Shared Card ──────────────────────────────────────────────────────────────

export function BrokerCard({
  title, subtitle, children, className = "", action,
}: {
  title?: string; subtitle?: string; children: ReactNode;
  className?: string; action?: ReactNode;
}) {
  return (
    <div className={`rounded-[3px] bg-card border border-border p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
