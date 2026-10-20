import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";

const CACHE_KEY = "tornadt-query-cache-v1";
const CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

// Warm cached maps and records appear immediately on launch; stale entries refresh in
// the background. Account settings and location searches stay out of local storage.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: CACHE_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

try {
  const saved = localStorage.getItem(CACHE_KEY);
  if (saved) {
    const entry = JSON.parse(saved) as { savedAt: number; cache: Parameters<typeof hydrate>[1] };
    if (Date.now() - entry.savedAt < CACHE_MAX_AGE) hydrate(queryClient, entry.cache);
    else localStorage.removeItem(CACHE_KEY);
  }
} catch {
  // Storage can be unavailable in private browsing or after a corrupt cache.
}

let persistTimer: number | undefined;
queryClient.getQueryCache().subscribe(() => {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      const cache = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" && !["profile", "geocode", "weather"].includes(String(query.queryKey[0])),
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), cache }));
    } catch {
      // A full or disabled storage area must not affect app usage.
    }
  }, 600);
});
