"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { API_URL } from "./api";
import type { PublicEvent } from "./types";

interface LiveCtx {
  /** Bumps (throttled) whenever the public ledger changes. Use as a refetch key. */
  version: number;
  connected: boolean;
  /** Most recent streamed ledger events, newest first. */
  recent: PublicEvent[];
}

const Ctx = createContext<LiveCtx>({ version: 0, connected: false, recent: [] });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [recent, setRecent] = useState<PublicEvent[]>([]);
  const pending = useRef(false);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/public/stream`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("ledger", (e) => {
      const item = JSON.parse((e as MessageEvent).data);
      if (typeof item.seq === "number") setRecent((r) => [item as PublicEvent, ...r].slice(0, 60));
      if (!pending.current) {
        pending.current = true;
        timer = setTimeout(() => {
          pending.current = false;
          setVersion((v) => v + 1);
        }, 350);
      }
    });
    es.onerror = () => setConnected(false);
    return () => {
      clearTimeout(timer);
      es.close();
    };
  }, []);

  return <Ctx.Provider value={{ version, connected, recent }}>{children}</Ctx.Provider>;
}

export function useLive() {
  return useContext(Ctx);
}
