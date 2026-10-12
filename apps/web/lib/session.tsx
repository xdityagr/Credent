"use client";

import bs58 from "bs58";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "./api";

export interface Session {
  token: string;
  wallet: string;
  demo: boolean;
}

interface SessionCtx {
  session: Session | null;
  /** False during server render / hydration, true once localStorage has been read. */
  ready: boolean;
  signInWithWallet: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => void;
}

const KEY = "credent.session";
const EVENT = "credent-session";
const Ctx = createContext<SessionCtx | null>(null);

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const noop = () => () => {};

function write(s: Session | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const session = useMemo<Session | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }, [raw]);
  const { publicKey, signMessage, disconnect } = useWallet();

  const signInWithWallet = useCallback(async () => {
    if (!publicKey) throw new Error("Connect a wallet first.");
    if (!signMessage) throw new Error("This wallet can't sign messages. Use a demo wallet instead.");
    const wallet = publicKey.toBase58();
    const { message } = await api<{ message: string }>("/auth/challenge", { body: { wallet } });
    const sig = await signMessage(new TextEncoder().encode(message));
    write(await api<Session>("/auth/verify", { body: { wallet, signature: bs58.encode(sig) } }));
  }, [publicKey, signMessage]);

  const signInDemo = useCallback(async () => {
    write(await api<Session>("/auth/demo", { method: "POST" }));
  }, []);

  const signOut = useCallback(() => {
    write(null);
    disconnect().catch(() => {});
  }, [disconnect]);

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
