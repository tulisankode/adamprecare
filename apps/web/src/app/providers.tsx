"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ApiError, bootstrapSession } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => {
              if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
              return count < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-right" offset={{ bottom: 64, right: 16 }} richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </QueryClientProvider>
  );
}
