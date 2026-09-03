import {
  useState, useRef, useEffect, useLayoutEffect, useContext, useCallback, useMemo, createContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  OverviewIcon, UsersIcon, KycIcon, SupportIcon, OrdersIcon, ErrorIcon,
  NewsIcon, SecuritiesIcon, NotificationsIcon, SettingsIcon, CashIcon, BrokersIcon,
  AuditLogIcon, ExpandIcon, ThemeIcon,
} from "./pine-icons";
import { Link, useNavigate, useLocation, useElementScrollRestoration } from "@tanstack/react-router";
import { useCurrentUser, logout, isSuperAdmin } from "@/lib/auth";
import { useKycQueue } from "@/hooks/useKyc";
import { useUnreadSupportCount, useSupportStats } from "@/hooks/useSupport";
import { usePendingWithdrawals } from "@/hooks/useWithdrawals";
import { useSystemErrorStats } from "@/hooks/useSystemErrors";
import { useNotificationDelivery } from "@/hooks/useNotificationDelivery";
import {
  ChevronDown, LogOut, Palette, CheckCircle2,
} from "lucide-react";

type NavGroup = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  section: string;
  badge?: string | number;
  /** Only visible to SUPER_ADMIN staff — broker admins never see these. */
  superAdminOnly?: boolean;
};

export const brokerNav: NavGroup[] = [
  // ── OVERVIEW ──
  { section: "OVERVIEW", icon: OverviewIcon, label: "Overview", href: "/" },

  // ── CLIENTS ──
  { section: "CLIENTS", icon: UsersIcon, label: "Users", href: "/users" },
  { section: "CLIENTS", icon: KycIcon, label: "KYC", href: "/kyc" },
  { section: "CLIENTS", icon: SupportIcon, label: "Support", href: "/support" },

  // ── TRADING ──
  { section: "TRADING", icon: OrdersIcon, label: "Orders", href: "/orders" },

  // ── PLATFORM (super admin only) ──
  { section: "PLATFORM", icon: BrokersIcon, label: "Brokers", href: "/brokers", superAdminOnly: true },
  { section: "PLATFORM", icon: AuditLogIcon, label: "Audit Log", href: "/audit", superAdminOnly: true },
  { section: "PLATFORM", icon: ErrorIcon, label: "System Errors", href: "/errors", superAdminOnly: true },
  { section: "PLATFORM", icon: NewsIcon, label: "News", href: "/news", superAdminOnly: true },
  { section: "PLATFORM", icon: Palette, label: "Mobile Themes", href: "/mobile-themes", superAdminOnly: true },
  { section: "PLATFORM", icon: SecuritiesIcon, label: "Treasury", href: "/treasury", superAdminOnly: true },

  // ── ACCOUNT ──
  { section: "ACCOUNT", icon: NotificationsIcon, label: "Client Notifications", href: "/notifications" },
  { section: "ACCOUNT", icon: SettingsIcon, label: "Settings", href: "/settings" },
];

export const brokerSectionOrder = ["OVERVIEW", "CLIENTS", "TRADING", "PLATFORM", "ACCOUNT"];

// ─── Dashboard time range ─────────────────────────────────────────────────────
// The topbar range picker feeds every time-scoped view (overview charts, the
// order blotter, the audit log, system errors and the client notification
// log), so the options are whole-day windows.

export type DashboardRange = "7d" | "14d" | "30d" | "90d";
const TIME_RANGES: Array<{ label: string; value: DashboardRange; short: string; days: number }> = [
  { label: "Last 7 days",   value: "7d",  short: "Last 7d",  days: 7 },
  { label: "Last 14 days",  value: "14d", short: "Last 14d", days: 14 },
  { label: "Last 30 days",  value: "30d", short: "Last 30d", days: 30 },
  { label: "Last 90 days",  value: "90d", short: "Last 90d", days: 90 },
];
const DEFAULT_RANGE: DashboardRange = "7d";

/** Start of the window: midnight, `days` days ago. */
function rangeStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DashboardRangeContext = createContext<{
  range: DashboardRange;
  days: number;
  /** ISO instant for the start of the window — pass straight to `dateFrom`. */
  dateFrom: string;
  setRange: (r: DashboardRange) => void;
}>({ range: DEFAULT_RANGE, days: 7, dateFrom: rangeStart(7).toISOString(), setRange: () => {} });

/** The topbar's selected time window — consumed by every range-aware page. */
export function useDashboardRange() {
  return useContext(DashboardRangeContext);
}

// ─── Module-level collapsed cache ─────────────────────────────────────────────
// Persists across client-side navigations so the sidebar never flashes open.
let _collapsedCache: boolean | null = null;

const SIDEBAR_KEY = "pine-broker-sidebar-collapsed";
const SIDEBAR_W = { collapsed: "4.5rem", expanded: "17rem" } as const;

/** Mirror the collapsed state onto <html> so the pre-paint script and CSS agree. */
function applySidebarAttr(collapsed: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
  root.style.setProperty("--pine-sidebar-w", collapsed ? SIDEBAR_W.collapsed : SIDEBAR_W.expanded);
}

// ─── Title context ─────────────────────────────────────────────────────────────
// The shell is a single persistent layout (rendered once in __root), so pages
// can no longer pass a `title` prop. Static titles are derived from the path
// via defaultTitleFor(); pages that need a dynamic title (e.g. an order's id)
// set it imperatively with useDashboardTitle(). `forPath` scopes the override
// to the route that set it, so a stale title never bleeds across a section
// switch.
type TitleState = { title: string | null; forPath: string | null };
const DashboardTitleContext = createContext<
  TitleState & { setTitle: (title: string | null, forPath: string) => void }
>({ title: null, forPath: null, setTitle: () => {} });

export function DashboardTitleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TitleState>({ title: null, forPath: null });
  const setTitle = useCallback((title: string | null, forPath: string) => {
    setState({ title, forPath });
  }, []);
  const titleValue = useMemo(() => ({ ...state, setTitle }), [state, setTitle]);

  const [range, setRange] = useState<DashboardRange>(DEFAULT_RANGE);
  const rangeValue = useMemo(() => {
    const days = TIME_RANGES.find((r) => r.value === range)?.days ?? 7;
    return { range, setRange, days, dateFrom: rangeStart(days).toISOString() };
  }, [range]);

  return (
    <DashboardTitleContext.Provider value={titleValue}>
      <DashboardRangeContext.Provider value={rangeValue}>
        {children}
      </DashboardRangeContext.Provider>
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
  "/notifications": "Client Notifications",
  "/support": "Support",
  "/mobile-themes": "Mobile Themes",
  "/news": "News",
  "/treasury": "Treasury",
  "/brokers": "Brokers",
  "/audit": "Audit Log",
  "/errors": "System Errors",
};

function defaultTitleFor(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];
  if (pathname.startsWith("/orders/")) return "Orders";
  if (pathname.startsWith("/brokers/")) return "Brokers";
  if (pathname.startsWith("/users/")) return "User Management";
  if (pathname.startsWith("/kyc/")) return "KYC";
  if (pathname.startsWith("/support/")) return "Support";
  return "";
}

/** Derive the active sidebar item from the current path. */
function activeLabelFor(pathname: string): string {
  const exact = brokerNav.find((n) => n.href === pathname);
  if (exact) return exact.label;
  const nested = brokerNav.find(
    (n) => n.href !== "/" && pathname.startsWith(n.href + "/"),
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

  // With the top bar gone the section name lives in the browser tab instead,
  // so useDashboardTitle() still has somewhere to land.
  useEffect(() => {
    document.title = title ? `${title} · Pine` : "Pine";
  }, [title]);

  // Deliver desktop notifications for new alerts, app-wide, from one place.
  useNotificationDelivery();

  // Seed from the module-level cache so that on client-side navigations the
  // sidebar renders at its correct width on the very first frame. On the
  // initial SSR/hydration pass the cache is null: the width then comes from
  // the --pine-sidebar-w CSS var the pre-paint <head> script set from
  // localStorage, and the layout effect below adopts the real value before
  // the browser paints — so the sidebar never pops.
  const [collapsed, setCollapsed] = useState<boolean | null>(() => _collapsedCache);
  const [transitionReady, setTransitionReady] = useState(false);

  useLayoutEffect(() => {
    if (_collapsedCache === null) {
      const attr = document.documentElement.getAttribute("data-sidebar");
      _collapsedCache = attr
        ? attr === "collapsed"
        : window.localStorage.getItem(SIDEBAR_KEY) === "1";
      applySidebarAttr(_collapsedCache);
    }
    setCollapsed(_collapsedCache);
    // Enable CSS transition only after the sidebar has painted at its real size.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setTransitionReady(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !(c ?? false);
      _collapsedCache = next;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      applySidebarAttr(next);
      return next;
    });
  };

  // The window never scrolls — this inner div does — so restore its scroll
  // position per location instead of relying on window scroll restoration.
  const scrollRef = useRef<HTMLDivElement>(null);
  useElementScrollRestoration({ id: "dashboard-scroll", getElement: () => scrollRef.current });

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <BrokerSidebar
        activeLabel={activeLabel}
        collapsed={collapsed}
        transitionReady={transitionReady}
        onToggleCollapse={toggleCollapse}
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* No top bar. Notifications and the theme toggle live in the sidebar;
            each page owns its own heading and search. */}
        <div
          ref={scrollRef}
          data-scroll-restoration-id="dashboard-scroll"
          className="flex-1 min-h-0 overflow-y-auto px-8 pt-4 pb-10 scrollbar-thin-gray"
        >
          <div className="space-y-6 animate-in fade-in duration-150 ease-out">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function BrokerSidebar({
  activeLabel, collapsed, transitionReady, onToggleCollapse,
}: {
  activeLabel: string;
  collapsed: boolean | null;
  transitionReady: boolean;
  onToggleCollapse: () => void;
}) {
  // Live pending KYC count — replaces the hardcoded badge value.
  const { data: kycData } = useKycQueue({ status: 'PENDING', limit: 1 });
  const pendingKycCount = kycData?.count ?? 0;

  // Live count of support tickets awaiting a staff reply.
  const awaitingSupportCount = useUnreadSupportCount();

  // Role-aware nav: broker admins only see their operational scope; the
  // PLATFORM section (and other superAdminOnly items) is SUPER_ADMIN only.
  const user = useCurrentUser();
  const superAdmin = isSuperAdmin(user);

  // Merge live badge counts into the static nav definition. Memoised so poll
  // ticks that return the same numbers don't rebuild the nav tree.
  const navWithBadges = useMemo(() => {
    const visible = brokerNav.filter((item) => !item.superAdminOnly || superAdmin);
    return visible.map((item) => {
      if (item.label === 'KYC') {
        return { ...item, badge: pendingKycCount > 0 ? pendingKycCount : undefined };
      }
      if (item.label === 'Support') {
        return { ...item, badge: awaitingSupportCount > 0 ? awaitingSupportCount : undefined };
      }
      return item;
    });
  }, [superAdmin, pendingKycCount, awaitingSupportCount]);

  const isCollapsed = collapsed === true;
  return (
    <aside
      className={`relative shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border ${
        collapsed === null ? "overflow-hidden" : "overflow-visible"
      }`}
      style={{
        width: collapsed === null
          ? `var(--pine-sidebar-w, ${SIDEBAR_W.expanded})`
          : isCollapsed ? SIDEBAR_W.collapsed : SIDEBAR_W.expanded,
        transition: transitionReady ? "width 300ms ease-in-out" : "none",
      }}
    >
      {/* Header */}
      <div className="relative z-10 flex items-center h-16 px-3 shrink-0">
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-foreground leading-none">Pine</div>
            <div className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">
              {superAdmin ? "PLATFORM ADMIN" : "BROKER PORTAL"}
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${isCollapsed ? "mx-auto" : "ml-auto"}`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {/* One glyph, flipped — the same control in both directions. */}
          <ExpandIcon className={`w-4 h-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
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
                    collapsed={isCollapsed}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Utilities — moved off the old top bar. */}
      <div className={`shrink-0 border-t border-sidebar-border p-3 flex items-center gap-2 ${isCollapsed ? "flex-col" : ""}`}>
        <WorkQueueBell />
        <ThemeToggle />
      </div>

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
  item, active, collapsed,
}: {
  item: NavGroup; active: boolean; collapsed: boolean;
}) {
  const Icon = item.icon;
  const liRef = useRef<HTMLLIElement>(null);
  const [flyoutTop, setFlyoutTop] = useState<number | null>(null);

  /* ── Collapsed: icon only + portal tooltip flyout ── */
  if (collapsed) {
    const cls = `relative w-full flex items-center justify-center p-2.5 rounded-[4px] transition-colors ${active ? "bg-muted" : "hover:bg-muted"}`;
    const flyout = flyoutTop !== null
      ? createPortal(
          <div
            className="fixed z-[200] pl-3 pointer-events-none"
            style={{ top: flyoutTop, left: "4.5rem" }}
          >
            <div className="bg-[#1a1a1a] rounded-[6px] shadow-2xl px-3 py-1.5 flex items-center gap-2">
              <span className="text-[13px] font-medium text-white leading-none whitespace-nowrap">{item.label}</span>
              {item.badge != null && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/15 text-white/70 leading-none shrink-0">{item.badge}</span>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

    return (
      <li
        ref={liRef}
        onMouseEnter={() => { const r = liRef.current?.getBoundingClientRect(); if (r) setFlyoutTop(r.top); }}
        onMouseLeave={() => setFlyoutTop(null)}
      >
        <div className="relative">
          <Link to={item.href} className={cls}>
            <Icon className={`w-[18px] h-[18px] ${active ? "text-foreground" : "text-muted-foreground"}`} />
          </Link>
          {item.badge != null && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground" />}
        </div>
        {flyout}
      </li>
    );
  }

  /* ── Expanded: icon + label ── */
  const rowCls = `relative w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[13px] font-[450] transition-colors ${
    active
      ? "bg-muted text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;

  return (
    <li>
      <Link to={item.href} className={rowCls}>
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`} />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge != null && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none bg-muted text-muted-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

/**
 * Dark/light toggle. Lives in the sidebar now that there is no top bar.
 *
 * Theme preference is PER-USER: keyed by the signed-in account id so two
 * people sharing a browser (or one person with admin + broker accounts)
 * never overwrite each other's choice. The legacy global key is read once as
 * a migration fallback, never written again.
 *
 * The pre-paint <head> script in __root.tsx resolves the same key and adds the
 * `dark` class before first paint; this layout effect adopts that value into
 * React state before the browser paints, so the icon and the page theme never
 * flip after load.
 */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const themeUser = useCurrentUser();
  const themeKey = themeUser?.id ? `pine-theme:${themeUser.id}` : "pine-theme";

  useLayoutEffect(() => {
    const stored = localStorage.getItem(themeKey) ?? localStorage.getItem("pine-theme");
    const initialDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initialDark);
    setMounted(true);
    // Re-resolve when the signed-in user changes (login/logout/switch).
  }, [themeKey]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (dark) { root.classList.add("dark"); localStorage.setItem(themeKey, "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem(themeKey, "light"); }
  }, [dark, mounted, themeKey]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="w-9 h-9 rounded-[4px] flex items-center justify-center hover:bg-muted/60 transition-colors"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      <ThemeIcon className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

// ─── Work queue bell ──────────────────────────────────────────────────────────
// The badge counts what THIS ADMIN has to act on — never investors' unread
// notifications (those belong to the clients' own inboxes and mean nothing
// here). Everything is assembled from hooks the dashboard already polls, so
// the popover costs no extra requests.

type QueueItem = {
  key: string;
  label: string;
  detail: string;
  count: number;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

function WorkQueueBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const superAdmin = isSuperAdmin(useCurrentUser());

  const { data: kyc } = useKycQueue({ status: "PENDING", limit: 1 });
  const { data: withdrawals } = usePendingWithdrawals();
  const { data: support } = useSupportStats();
  // Platform-only endpoint — never fire it for broker admins (403).
  const { data: errors } = useSystemErrorStats({ enabled: superAdmin });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = useMemo<QueueItem[]>(() => {
    const openTickets = support?.open ?? 0;
    const list: QueueItem[] = [
      {
        key: "kyc",
        label: "KYC applications",
        detail: "waiting for review",
        count: kyc?.count ?? 0,
        to: "/kyc",
        icon: KycIcon,
      },
      {
        key: "withdrawals",
        label: "Withdrawal requests",
        detail: "waiting for approval",
        count: withdrawals?.withdrawals?.length ?? 0,
        to: "/",
        icon: CashIcon,
      },
      {
        key: "support",
        label: "Support tickets",
        detail: openTickets > 0 ? `awaiting your reply · ${openTickets} open` : "awaiting your reply",
        count: support?.awaitingAdmin ?? 0,
        to: "/support",
        icon: SupportIcon,
      },
    ];
    if (superAdmin) {
      list.push({
        key: "errors",
        label: "System errors",
        detail: "still open",
        count: errors?.open ?? 0,
        to: "/errors",
        icon: ErrorIcon,
      });
    }
    return list;
  }, [kyc?.count, withdrawals?.withdrawals?.length, support?.awaitingAdmin, support?.open, errors?.open, superAdmin]);

  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-9 h-9 rounded-[4px] flex items-center justify-center relative transition-colors ${
          open ? "text-pine bg-muted/60" : "hover:bg-muted/60"
        }`}
        aria-label={total > 0 ? `Work queue — ${total} item${total === 1 ? "" : "s"}` : "Work queue"}
        aria-expanded={open}
      >
        <NotificationsIcon className={`w-4 h-4 ${open ? "text-pine" : "text-muted-foreground"}`} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1.5 z-50 w-[19rem] bg-card border border-border rounded-[4px] shadow-xl overflow-hidden">
          <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">NEEDS YOUR ATTENTION</span>
            {total > 0 && (
              <span className="text-[10px] font-semibold text-muted-foreground">{total}</span>
            )}
          </div>
          {total === 0 ? (
            <div className="px-3.5 pb-5 pt-2 text-center">
              <CheckCircle2 className="w-7 h-7 text-pine mx-auto mb-2" />
              <p className="text-[13px] font-medium">Nothing needs your attention</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Every queue is clear right now.
              </p>
            </div>
          ) : (
            <ul className="pb-1.5">
              {items.filter((i) => i.count > 0).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted transition-colors"
                    >
                      <span className="w-7 h-7 shrink-0 rounded-[3px] bg-muted flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-foreground truncate">{item.label}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{item.detail}</span>
                      </span>
                      <span className="text-[11px] font-bold text-foreground tabular-nums shrink-0">{item.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
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
