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
      const user = getCurrentUser();
      throw redirect({ to: user?.role === "BROKER" ? "/broker" : "/" });
    }

    if (authed && !onLogin) {
      const user = getCurrentUser();
      // Keep this list in sync with any new routes that brokers should access.
      // Using `as const` ensures TypeScript catches typos at the call sites.
      const BROKER_ALLOWED_PATHS = [
        "/broker",
        "/users",
        "/kyc",
        "/orders",
        "/notifications",
        "/coming-soon",
        "/settings",
      ] as const;
      const isBrokerAllowed = BROKER_ALLOWED_PATHS.some((p) =>
        location.pathname.startsWith(p),
      );
      if (user?.role === "BROKER" && !isBrokerAllowed) {
        throw redirect({ to: "/broker" });
      }
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
 *   - redirects to /login (unauthenticated access to a protected route), or
 *   - redirects to /broker (BROKER role accessing an admin-only route), or
 *   - adds .pine-auth-ready to <html>, which lifts the visibility:hidden set in
 *     styles.css and allows the body to paint.
 *
 * This script must stay in sync with the BROKER_ALLOWED_PATHS list in beforeLoad.
 */
const AUTH_GUARD_SCRIPT = `(function(){
  try{
    var token=localStorage.getItem('pine_admin_access_token');
    var path=location.pathname;
    var onLogin=path==='/login';
    if(!token&&!onLogin){location.replace('/login');return;}
    if(token&&!onLogin){
      var BROKER_PATHS=['/broker','/users','/kyc','/orders','/notifications','/coming-soon','/settings'];
      var isBrokerPath=BROKER_PATHS.some(function(p){return path===p||path.startsWith(p+'/');});
      try{
        var u=JSON.parse(localStorage.getItem('pine_admin_user')||'null');
        if(u&&u.role==='BROKER'&&!isBrokerPath){location.replace('/broker');return;}
      }catch(e){}
    }
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

  // Register the router's navigate function so ApiClient can use it for
  // session-expiry redirects instead of window.location.href, which would
  // bypass the router and destroy React state.
  useEffect(() => {
    registerNavigate((to) => navigate({ to: to as any }));
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
