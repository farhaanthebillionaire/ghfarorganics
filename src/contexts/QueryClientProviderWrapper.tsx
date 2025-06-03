'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // Optional
import { useState } from 'react';

export function QueryClientProviderWrapper({ children }: { children: ReactNode }) {
  // useState ensures QueryClient is only created once per component lifecycle,
  // preventing re-creation on re-renders, which is important for stability.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Global default query options can go here
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false, // Optional: disable refetch on window focus
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Optional: React Query Devtools for development */}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}
