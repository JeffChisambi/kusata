import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  redirect,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { registerNavigate } from "@/lib/nav-registry";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ComingSoonView } from "../components/coming-soon-view";
import { DashboardLayout, DashboardTitleProvider } from "../components/broker-shell";

// Real dashboard sections get the persistent shell (sidebar + topbar). Login,
// coming-soon and any not-found path render bare/full-screen.
const SHELL_PREFIXES = ["/users", "/kyc", "/orders", "/settings", "/notifications", "/news"];
function isShellRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  );
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

    if (!authed && !onLogin) {
      throw redirect({ to: "/login" });
    }

    if (authed && onLogin) {
      throw redirect({ to: "/" });
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Inline auth-guard script injected into <head>.
 *
 * Runs synchronously before the browser paints a single pixel of body content.
 * Checks localStorage for a valid token and either:
 *   - redirects to /login (unauthenticated access to a protected route)
 *   - adds .pine-auth-ready to <html>, which lifts the visibility:hidden set in
 *     styles.css and allows the body to paint.
 */
const AUTH_GUARD_SCRIPT = `(function(){
  try{
    var token=localStorage.getItem('pine_admin_access_token');
    var path=location.pathname;
    var onLogin=path==='/login';
    if(!token&&!onLogin){location.replace('/login');return;}
  }catch(e){}
  document.documentElement.classList.add('pine-auth-ready');
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

  // Register the router's navigate function so ApiClient can use it for
  // session-expiry redirects instead of window.location.href, which would
  // bypass the router and destroy React state.
  useEffect(() => {
    registerNavigate((to) => navigate({ to: to as any }));
  }, [navigate]);

  // The shell is mounted ONCE here and persists across section switches — only
  // the <Outlet/> content changes — so the sidebar/topbar never remount and the
  // transition is seamless.
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardTitleProvider>
        {isShellRoute(pathname) ? (
          <DashboardLayout>
            <Outlet />
          </DashboardLayout>
        ) : (
          <Outlet />
        )}
      </DashboardTitleProvider>
    </QueryClientProvider>
  );
}
