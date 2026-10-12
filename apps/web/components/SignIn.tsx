"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Notice, Sheet } from "./ui";

export function SignIn({ title, body }: { title: string; body: string }) {
  const { signInWithWallet, signInDemo } = useSession();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [busy, setBusy] = useState<"wallet" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "wallet" | "demo") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "wallet") await signInWithWallet();
      else await signInDemo();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet className="max-w-xl p-7">
      <h2 className="text-[24px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {connected && publicKey ? (
          <Button busy={busy === "wallet"} onClick={() => go("wallet")}>
            Sign message with {publicKey.toBase58().slice(0, 4)}…
          </Button>
        ) : (
          <Button onClick={() => setVisible(true)}>Connect Solana wallet</Button>
        )}
        <Button variant="quiet" busy={busy === "demo"} onClick={() => go("demo")}>
          Use a demo wallet
        </Button>
      </div>
      <p className="mt-4 text-[13px] text-ink-faint">
        Signing proves you control the address. It is not a transaction and costs nothing.
      </p>
      {error && (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      )}
    </Sheet>
  );
}
