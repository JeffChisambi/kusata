import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Shared QueryClient default options.
 *
 * staleTime: 30s — prevents re-fetching data that was just loaded when the
 * user navigates between routes. Previously 0, which re-fetched everything
 * on every navigation.
 *
 * gcTime: 5 min — keep unused data in cache for 5 minutes (React Query default).
 */
const QUERY_DEFAULTS = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
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
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
