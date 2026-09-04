import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  useMatches,
  redirect,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { isAuthenticated } from "@/lib/auth";
import { registerNavigate } from "@/lib/nav-registry";
import { enforceAccess } from "@/lib/sections";
import { installErrorReporter } from "@/lib/error-reporter";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ComingSoonView } from "../components/coming-soon-view";
import { DashboardLayout, DashboardTitleProvider } from "../components/broker-shell";

// Every authenticated section renders inside the persistent shell (sidebar +
// topbar). Only the public auth pages and a not-found path render bare, so
// adding a new dashboard route never requires touching this list.
const BARE_PATHS = new Set(["/login", "/activate", "/change-password"]);
function isBareRoute(pathname: string): boolean {
  return BARE_PATHS.has(pathname);
}

function NotFoundComponent() {
  return <ComingSoonView />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-[3px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-[3px] border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kusata — Pine Admin Dashboard" },
      { name: "description", content: "Pine brokerage administration dashboard" },
      { name: "author", content: "Pine" },
      { property: "og:title", content: "Kusata — Pine Admin Dashboard" },
      { property: "og:description", content: "Pine brokerage administration dashboard" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  // Block route loading BEFORE any component renders — no flash possible
  beforeLoad: ({ location }) => {
    // Server-side: no localStorage, skip auth check (SSR renders the spinner shell)
    if (typeof window === "undefined") return;

    const authed = isAuthenticated();
    const onLogin = location.pathname === "/login";
    // /activate is public: invited broker admins land here with their one-time
    // invitation token before they have any credentials.
    const isPublic = onLogin || location.pathname === "/activate";

    if (!authed && !isPublic) {
      throw redirect({ to: "/login" });
    }

    if (authed && onLogin) {
      throw redirect({ to: "/" });
    }

    // Staff may only open the sections they were granted, and anyone still
    // on a temporary password goes to /change-password before anything else.
    // The API enforces both independently; this keeps people off screens
    // that would only refuse them.
    if (authed) enforceAccess(location.pathname);
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Inline auth-guard + pre-paint preferences script injected into <head>.
 *
 * Runs synchronously before the browser paints a single pixel of body content.
 * Checks localStorage for a valid token and either:
 *   - redirects to /login (unauthenticated access to a protected route)
 *   - adds .pine-auth-ready to <html>, which lifts the visibility:hidden set in
 *     styles.css and allows the body to paint.
 *
 * It also applies the two persisted UI preferences BEFORE first paint so the
 * shell never flashes and then flips:
 *   - theme: the per-user key `pine-theme:<userId>` (falling back to the legacy
 *     global `pine-theme`, then the OS preference) — mirrors BrokerTopbar.
 *   - sidebar: `pine-broker-sidebar-collapsed` → `data-sidebar` attribute and
 *     the `--pine-sidebar-w` CSS var that the sidebar's SSR frame is sized from.
 */
const AUTH_GUARD_SCRIPT = `(function(){
  var root=document.documentElement;
  try{
    var token=localStorage.getItem('pine_admin_access_token');
    var path=location.pathname;
    var isPublic=path==='/login'||path==='/activate';
    if(!token&&!isPublic){location.replace('/login');return;}
    var userId=null;
    try{var u=JSON.parse(localStorage.getItem('pine_admin_user')||'null');userId=u&&u.id;}catch(e){}
    var stored=null;
    if(userId){stored=localStorage.getItem('pine-theme:'+userId);}
    if(stored===null){stored=localStorage.getItem('pine-theme');}
    var dark=stored!==null?stored==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    if(dark){root.classList.add('dark');}
    var collapsed=localStorage.getItem('pine-broker-sidebar-collapsed')==='1';
    root.setAttribute('data-sidebar',collapsed?'collapsed':'expanded');
    root.style.setProperty('--pine-sidebar-w',collapsed?'4.5rem':'17rem');
  }catch(e){}
  root.classList.add('pine-auth-ready');
})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Auth guard: runs before body paints — see AUTH_GUARD_SCRIPT comment above */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: AUTH_GUARD_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // A not-found path renders the full-screen ComingSoonView without the shell.
  const isNotFound = useMatches({
    select: (matches) => matches.some((m) => m.status === "notFound" || m.globalNotFound === true),
  });

  // Register the router's navigate function so ApiClient can use it for
  // session-expiry redirects instead of window.location.href, which would
  // bypass the router and destroy React state.
  useEffect(() => {
    registerNavigate((to) => navigate({ to: to as any }));
  }, [navigate]);

  // Ship unhandled errors to the platform System Errors console.
  useEffect(() => {
    installErrorReporter();
  }, []);

  // The shell is mounted ONCE here and persists across section switches — only
  // the <Outlet/> content changes — so the sidebar/topbar never remount and the
  // transition is seamless.
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardTitleProvider>
        {isBareRoute(pathname) || isNotFound ? (
          <Outlet />
        ) : (
          <DashboardLayout>
            <Outlet />
          </DashboardLayout>
        )}
      </DashboardTitleProvider>
    </QueryClientProvider>
  );
}
