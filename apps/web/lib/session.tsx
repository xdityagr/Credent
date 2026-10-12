"use client";

import bs58 from "bs58";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "./api";

export interface Session {
  token: string;
  wallet: string;
  demo: boolean;
}

interface SessionCtx {
  session: Session | null;
  ready: boolean;
  signInWithWallet: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => void;
}

const KEY = "credent.session";
const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const { publicKey, signMessage, disconnect } = useWallet();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(KEY);
    }
    setReady(true);
  }, []);

  const store = useCallback((s: Session | null) => {
    setSession(s);
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  }, []);

  const signInWithWallet = useCallback(async () => {
    if (!publicKey) throw new Error("Connect a wallet first.");
    if (!signMessage) throw new Error("This wallet can't sign messages. Use a demo wallet instead.");
    const wallet = publicKey.toBase58();
    const { message } = await api<{ message: string }>("/auth/challenge", { body: { wallet } });
    const sig = await signMessage(new TextEncoder().encode(message));
    const s = await api<Session>("/auth/verify", { body: { wallet, signature: bs58.encode(sig) } });
    store(s);
  }, [publicKey, signMessage, store]);

  const signInDemo = useCallback(async () => {
    store(await api<Session>("/auth/demo", { method: "POST" }));
  }, [store]);

  const signOut = useCallback(() => {
    store(null);
    disconnect().catch(() => {});
  }, [store, disconnect]);

  const value = useMemo(
    () => ({ session, ready, signInWithWallet, signInDemo, signOut }),
    [session, ready, signInWithWallet, signInDemo, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
