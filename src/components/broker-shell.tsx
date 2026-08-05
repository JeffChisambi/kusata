import {
  useState, useRef, useEffect, useContext, useCallback, createContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useCurrentUser, logout } from "@/lib/auth";
import { useKycQueue } from "@/hooks/useKyc";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useNotificationDelivery } from "@/hooks/useNotificationDelivery";
import {
  Users, ShieldCheck, FileCheck2,
  ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  CircleUser, Clock, Sun, Moon, Bell, Check, LogOut,
  ClipboardList, Settings2, Search,
} from "lucide-react";

function NineDotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.75" />
      <circle cx="8"   cy="2.5" r="1.75" />
      <circle cx="13.5" cy="2.5" r="1.75" />
      <circle cx="2.5" cy="8"   r="1.75" />
      <circle cx="8"   cy="8"   r="1.75" />
      <circle cx="13.5" cy="8"   r="1.75" />
      <circle cx="2.5" cy="13.5" r="1.75" />
      <circle cx="8"   cy="13.5" r="1.75" />
      <circle cx="13.5" cy="13.5" r="1.75" />
    </svg>
  );
}

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
  { section: "OVERVIEW", icon: NineDotsIcon, label: "Overview", href: "/" },

  // ── CLIENTS ──
  { section: "CLIENTS", icon: Users, label: "Users", href: "/users" },
  { section: "CLIENTS", icon: FileCheck2, label: "KYC", href: "/kyc" },

  // ── TRADING ──
  { section: "TRADING", icon: ClipboardList, label: "Orders", href: "/orders" },
  { section: "TRADING", icon: ShieldCheck, label: "Auth & Security", href: "/coming-soon" },

  // ── ACCOUNT ──
  { section: "ACCOUNT", icon: Settings2, label: "Settings", href: "/settings" },
];

export const brokerSectionOrder = ["OVERVIEW", "CLIENTS", "TRADING", "ACCOUNT"];

const TIME_RANGES = [
  { label: "Last 1 hour",   value: "1h",  short: "Last 1h"  },
  { label: "Last 6 hours",  value: "6h",  short: "Last 6h"  },
  { label: "Last 12 hours", value: "12h", short: "Last 12h" },
  { label: "Last 24 hours", value: "24h", short: "Last 24h" },
  { label: "Last 7 days",   value: "7d",  short: "Last 7d"  },
  { label: "Last 30 days",  value: "30d", short: "Last 30d" },
  { label: "Last 90 days",  value: "90d", short: "Last 90d" },
];

// ─── Module-level collapsed cache ─────────────────────────────────────────────
// Persists across client-side navigations so the sidebar never flashes open.
let _collapsedCache: boolean | null = null;

// ─── Title context ─────────────────────────────────────────────────────────────
// The shell is now a single persistent layout (rendered once in __root), so
// pages can no longer pass a `title` prop. Static titles are derived from the
// path via defaultTitleFor(); pages that need a dynamic title (e.g. an order's
// id) set it imperatively with useDashboardTitle(). `forPath` scopes the
// override to the route that set it, so a stale title never bleeds across a
// section switch.
type TitleState = { title: string | null; forPath: string | null };
const DashboardTitleContext = createContext<
  TitleState & { setTitle: (title: string | null, forPath: string) => void }
>({ title: null, forPath: null, setTitle: () => {} });

export function DashboardTitleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TitleState>({ title: null, forPath: null });
  const setTitle = useCallback((title: string | null, forPath: string) => {
    setState({ title, forPath });
  }, []);
  return (
    <DashboardTitleContext.Provider value={{ ...state, setTitle }}>
      {children}
    </DashboardTitleContext.Provider>
  );
}

/** Set the topbar title for the current route (for dynamic titles). */
export function useDashboardTitle(title: string) {
  const { setTitle } = useContext(DashboardTitleContext);
  const { pathname } = useLocation();
  useEffect(() => { setTitle(title, pathname); }, [title, pathname, setTitle]);
}

const STATIC_TITLES: Record<string, string> = {
  "/": "Broker Overview",
  "/users": "User Management",
  "/kyc": "KYC",
  "/orders": "Orders",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

function defaultTitleFor(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];
  if (pathname.startsWith("/orders/")) return "Orders";
  return "";
}

/** Derive the active sidebar item from the current path. */
function activeLabelFor(pathname: string): string {
  const exact = brokerNav.find((n) => n.href === pathname);
  if (exact) return exact.label;
  const nested = brokerNav.find(
    (n) => n.href && n.href !== "/" && pathname.startsWith(n.href + "/"),
  );
  return nested?.label ?? "";
}

// ─── DashboardLayout ─────────────────────────────────────────────────────────
// Persistent chrome: rendered once by __root around <Outlet/>. Only the content
// swaps between sections, so the sidebar and topbar never remount (no glitch).

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ctx = useContext(DashboardTitleContext);
  const activeLabel = activeLabelFor(pathname);
  const title = ctx.forPath === pathname && ctx.title ? ctx.title : defaultTitleFor(pathname);

  // Deliver desktop notifications for new alerts, app-wide, from one place.
  useNotificationDelivery();

  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Seed from the module-level cache so that on client-side navigations — where
  // this shell remounts — the sidebar renders at its correct width on the very
  // first frame instead of flashing from 0 → full width (the section-switch
  // "glitch"). On the initial SSR/first load the cache is still null, so we
  // keep the hidden-until-measured behaviour that avoids a hydration mismatch.
  const [collapsed, setCollapsed] = useState<boolean | null>(() => _collapsedCache);
  const [transitionReady, setTransitionReady] = useState(false);

  useEffect(() => {
    // If we've navigated before, the cache is already set — use it immediately.
    if (_collapsedCache === null) {
      _collapsedCache = window.localStorage.getItem("pine-broker-sidebar-collapsed") === "1";
    }
    setCollapsed(_collapsedCache);
    // Enable CSS transition only after the sidebar has painted at its real size.
    requestAnimationFrame(() => requestAnimationFrame(() => setTransitionReady(true)));
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !(c ?? false);
      _collapsedCache = next;
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
        transitionReady={transitionReady}
        onToggleCollapse={toggleCollapse}
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <BrokerTopbar title={title} />
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-10 scrollbar-thin-gray">
          {/* Keyed by path so the content cross-fades on every section switch,
              giving a smooth transition instead of an abrupt swap. */}
          <div key={pathname} className="space-y-6 animate-in fade-in duration-300 ease-out">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function BrokerSidebar({
  open, setOpen, activeLabel, collapsed, transitionReady, onToggleCollapse,
}: {
  open: Record<string, boolean>;
  setOpen: (v: Record<string, boolean>) => void;
  activeLabel: string;
  collapsed: boolean | null;
  transitionReady: boolean;
  onToggleCollapse: () => void;
}) {
  // Live pending KYC count — replaces the hardcoded badge value.
  const { data: kycData } = useKycQueue({ status: 'PENDING', limit: 1 });
  const pendingKycCount = kycData?.count ?? 0;

  // Merge live badge counts into the static nav definition.
  const navWithBadges = brokerNav.map((item) => {
    if (item.label === 'KYC') {
      return { ...item, badge: pendingKycCount > 0 ? pendingKycCount : undefined };
    }
    return item;
  });

  const isCollapsed = collapsed === true;
  return (
    <aside
      className="relative shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border overflow-visible"
      style={{
        width: collapsed === null ? 0 : isCollapsed ? "4.5rem" : "17rem",
        transition: transitionReady ? "width 300ms ease-in-out" : "none",
        visibility: collapsed === null ? "hidden" : "visible",
      }}
    >
      {/* Header */}
      <div className="relative z-10 flex items-center h-16 px-3 shrink-0">
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-foreground leading-none">Pine</div>
            <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">BROKER PORTAL</div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${isCollapsed ? "mx-auto" : "ml-auto"}`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? <ChevronsRight className="w-4 h-4" />
            : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-3">
        {brokerSectionOrder.map((section, sectionIdx) => {
          const items = navWithBadges.filter((n) => n.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className={sectionIdx > 0 ? "mt-1" : ""}>
              {sectionIdx > 0 && (
                <div className="mx-4 mb-2">
                  <div className="border-t border-sidebar-border" />
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
                    collapsed={isCollapsed}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <UserFooter collapsed={isCollapsed} />
      </div>
    </aside>
  );
}

function UserFooter({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Broker';
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'BROKER';
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'B';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    // Use the router's navigate instead of window.location.href so React state
    // is torn down cleanly and the router's history stack stays consistent.
    navigate({ to: '/login' });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className={`w-full flex items-center rounded-[6px] px-2 py-2 hover:bg-muted cursor-pointer transition-colors ${collapsed ? "justify-center" : "gap-2.5"}`}
      >
        <div className="w-8 h-8 shrink-0 rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
          <span className="text-[11px] font-bold text-foreground">{initials}</span>
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
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-rose hover:bg-rose/5 transition-colors text-left"
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
    const cls = `relative w-full flex items-center justify-center p-2.5 rounded-[4px] transition-colors ${active ? "bg-muted" : "hover:bg-muted"}`;
    const flyout = flyoutTop !== null
      ? createPortal(
          <div
            className="fixed z-[200] pl-3"
            style={{ top: flyoutTop, left: "4.5rem" }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            {hasChildren ? (
              <div className="bg-[#1a1a1a] rounded-[6px] shadow-2xl overflow-hidden min-w-[160px]">
                <div className="px-3.5 py-2.5 border-b border-white/10">
                  <span className="text-[12px] font-semibold text-white leading-none">{item.label}</span>
                  {item.badge != null && (
                    <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 leading-none">{item.badge}</span>
                  )}
                </div>
                <ul className="py-1 max-h-72 overflow-y-auto">
                  {item.children!.map((c) => (
                    <li key={c.label}>
                      <Link
                        to={c.href ?? "/coming-soon"}
                        className="w-full flex items-center gap-2 px-3.5 py-[7px] text-[12px] text-white/60 hover:text-white hover:bg-white/8 transition-colors text-left"
                      >
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.badge != null && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 leading-none shrink-0">{c.badge}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] rounded-[6px] shadow-2xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-[13px] font-medium text-white leading-none whitespace-nowrap">{item.label}</span>
                {item.badge != null && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/15 text-white/70 leading-none shrink-0">{item.badge}</span>
                )}
              </div>
            )}
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
            ? <Link to={item.href} className={cls}><Icon className={`w-[18px] h-[18px] ${active ? "text-foreground" : "text-muted-foreground"}`} /></Link>
            : <button className={cls}><Icon className={`w-[18px] h-[18px] ${active ? "text-foreground" : "text-muted-foreground"}`} /></button>}
          {item.badge != null && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground" />}
        </div>
        {flyout}
      </li>
    );
  }

  /* ── Expanded: icon + label with left-border active indicator ── */
  const rowCls = `relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[13px] font-[450] transition-colors ${
    active
      ? "bg-muted text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;

  const rowContent = (icon: React.ReactNode, label: string, badge?: string | number, chevron?: React.ReactNode) => (
    <>
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-muted text-muted-foreground">
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
            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />,
            item.label, item.badge,
            isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />,
          )}
        </button>
      ) : item.href ? (
        <Link to={item.href} className={rowCls}>
          {rowContent(<Icon className={`w-4 h-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />, item.label, item.badge)}
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
  const unreadCount = useUnreadNotificationCount();
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
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

// ─── Shared Card ──────────────────────────────────────────────────────────────

export function Card({
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
