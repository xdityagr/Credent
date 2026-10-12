"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PublicEvent } from "./types";

interface LiveCtx {
  connected: boolean;
  /** Most recent streamed ledger events, newest first. */
  recent: PublicEvent[];
}

const Ctx = createContext<LiveCtx>({ connected: false, recent: [] });

/**
 * Subscribes to the public ledger SSE stream and invalidates every "public"
 * query, throttled so a burst of events causes one refetch.
 */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [recent, setRecent] = useState<PublicEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let closed = false;

    const open = () => {
      es = new EventSource("/api/public/stream");
      es.addEventListener("hello", () => {
        attempts = 0;
        setConnected(true);
      });
      es.onopen = () => setConnected(true);
      es.addEventListener("ledger", (e) => {
        try {
          const item = JSON.parse((e as MessageEvent).data);
          if (typeof item?.seq === "number") setRecent((r) => [item as PublicEvent, ...r].slice(0, 60));
        } catch {
          /* ignore malformed frames */
        }
        if (!timer.current) {
          timer.current = setTimeout(() => {
            timer.current = null;
            qc.invalidateQueries({ queryKey: ["public"] });
          }, 800);
        }
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        // back off when the API is down instead of hammering the dev rewrite
        if (!closed) retry = setTimeout(open, Math.min(30_000, 2_000 * 2 ** attempts++));
      };
    };
    open();

    return () => {
      closed = true;
      clearTimeout(retry);
      if (timer.current) clearTimeout(timer.current);
      es?.close();
    };
  }, [qc]);

  return <Ctx.Provider value={{ connected, recent }}>{children}</Ctx.Provider>;
}

export function useLive() {
  return useContext(Ctx);
}
