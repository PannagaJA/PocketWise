import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds fresh in cache, then background revalidates
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection time
      refetchOnWindowFocus: false, // Don't trigger refetch on every focus change
      refetchOnReconnect: true,
      refetchOnMount: true, // Always revalidate stale cache on mount so multi-device updates appear
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[Query Error] [${query.queryKey.join('/')}]:`, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('[Mutation Error]:', error);
    },
    onSuccess: () => {
      // Invalidate all TanStack Query caches instantly on ANY mutation across the app
      queryClient.invalidateQueries();
    },
  }),
});
