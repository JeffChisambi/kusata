import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";

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
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
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
  const location = useLocation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Auth + role guard — runs before first paint
  useEffect(() => {
    const authed = isAuthenticated();
    const onLogin = location.pathname === '/login';

    if (!authed && !onLogin) {
      navigate({ to: '/login' });
      return;
    }

    if (authed && onLogin) {
      // Already logged in, skip login page
      const user = getCurrentUser();
      navigate({ to: user?.role === 'BROKER' ? '/broker' : '/' });
      return;
    }

    if (authed && !onLogin) {
      const user = getCurrentUser();
      const brokerAllowed = ['/broker', '/users', '/kyc', '/notifications', '/coming-soon'];
      const isBrokerAllowed = brokerAllowed.some((p) => location.pathname.startsWith(p));
      if (user?.role === 'BROKER' && !isBrokerAllowed) {
        navigate({ to: '/broker' });
        return;
      }
    }

    setReady(true);
  }, [location.pathname, navigate]);

  // Block rendering until auth check completes — prevents flash of protected content
  if (!ready) {
    return (
      <html lang="en">
        <head><HeadContent /></head>
        <body>
          <div className="flex h-screen items-center justify-center bg-background">
            <div className="w-8 h-8 border-2 border-pine border-t-transparent rounded-full animate-spin" />
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
