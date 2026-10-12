"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api";
import { LiveProvider } from "@/lib/live";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (n, e) => {
          // Don't retry auth/validation errors, and give up quickly when the API is down.
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) return false;
          return n < 1;
        },
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <LiveProvider>{children}</LiveProvider>
      </MotionConfig>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "!rounded-[18px] !border !border-white/10 !bg-[#111113]/95 !backdrop-blur-xl !text-[#ededed] !font-sans !shadow-[0_20px_60px_-15px_rgb(0_0_0/0.9)]",
            description: "!text-[#9a9a9f]",
            success: "[&_[data-icon]]:!text-[#4fe0a6]",
            error: "[&_[data-icon]]:!text-[#ff6b5e]",
          },
        }}
      />
    </QueryClientProvider>
  );
}
