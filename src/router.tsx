import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Shared QueryClient default options.
 *
 * staleTime: 60s — prevents re-fetching data that was just loaded when the
 * user navigates between routes.
 *
 * gcTime: 5 min — keep unused data in cache for 5 minutes.
 *
 * placeholderData: keep the previous result while a new key (filter / page
 * change) loads, so lists never blank out between pages.
 *
 * refetchOnWindowFocus: off — the pollers already keep hot data fresh and a
 * tab switch shouldn't trigger a burst of requests. Hooks that want it can
 * opt back in.
 */
const QUERY_DEFAULTS = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      placeholderData: <T,>(prev: T | undefined) => prev,
      refetchOnWindowFocus: false,
    },
  },
};

/**
 * Client-side singleton QueryClient.
 * On the server, a fresh instance is created per request (SSR isolation).
 * On the client, a single instance persists across navigations so the cache
 * is not reset every time getRouter() is called (e.g. during HMR).
 */
let _clientQueryClient: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // SSR: always fresh per request to avoid cross-request cache pollution
    return new QueryClient(QUERY_DEFAULTS);
  }
  if (!_clientQueryClient) {
    _clientQueryClient = new QueryClient(QUERY_DEFAULTS);
  }
  return _clientQueryClient;
}

export const getRouter = () => {
  const queryClient = getQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Required for useElementScrollRestoration (the dashboard's inner scroller
    // in DashboardLayout) — the window itself never scrolls.
    scrollRestoration: true,
    // Start loading a route's code/loader on hover/focus so clicks feel instant.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    // Don't flash a pending UI for fast transitions; show one only if a
    // navigation takes longer than 300ms, and drop it as soon as it's ready.
    defaultPendingMs: 300,
    defaultPendingMinMs: 0,
  });

  return router;
};
