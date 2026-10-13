"use client";

/* eslint-disable @next/next/no-img-element -- wallet adapter icons are data URLs */
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { short } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Wallet } from "@/lib/types";

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** The organisation's primary wallet. Custodial wallets are signed by Credent; external ones by the browser wallet. */
export function usePrimaryWallet(): Wallet | null {
  const me = useSession();
  return me.wallets.find((w) => w.is_primary) ?? me.wallets[0] ?? null;
}

/**
 * Signing with the linked external wallet. `ready` is true only when the
 * connected browser wallet is the same address the organisation linked.
 */
export function useSigner() {
  const primary = usePrimaryWallet();
  const w = useWallet();
  const custodial = primary?.kind === "CUSTODIAL";
  const connectedAddr = w.publicKey?.toBase58() ?? null;
  const ready = custodial || (Boolean(primary) && w.connected && connectedAddr === primary?.address);

  async function signTx(txB64: string): Promise<string> {
    if (!w.signTransaction) throw new Error("This wallet can't sign transactions.");
    const tx = Transaction.from(b64ToBytes(txB64));
    const signed = await w.signTransaction(tx);
    return bytesToB64(new Uint8Array(signed.serialize({ requireAllSignatures: true, verifySignatures: true })));
  }

  async function signText(message: string): Promise<string> {
    if (!w.signMessage) throw new Error("This wallet can't sign messages.");
    return bs58.encode(await w.signMessage(new TextEncoder().encode(message)));
  }

  return { primary, custodial, ready, connectedAddr, mismatch: w.connected && !custodial && !ready, signTx, signText };
}

/** Prompt to connect the browser wallet that matches the organisation's primary wallet. */
export function ConnectForSigning() {
  const { primary, custodial, ready, mismatch, connectedAddr } = useSigner();
  const { wallets, wallet, select, connect, connected, connecting, disconnect } = useWallet();
  const [target, setTarget] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target || wallet?.adapter.name !== target || connected || connecting) return;
    connect().catch((e) => {
      setError(errorMessage(e) || "The wallet didn't connect.");
      setTarget(null);
    });
  }, [target, wallet, connected, connecting, connect]);

  if (!primary) return <p className="text-[13.5px] text-loss-text">Link a wallet in Settings first.</p>;
  if (custodial || ready) return null;

  const options = wallets.filter(
    (x) => x.readyState === WalletReadyState.Installed || x.readyState === WalletReadyState.Loadable,
  );
  return (
    <div className="rounded-[18px] border border-line-strong bg-white/[0.03] p-4">
      <p className="text-[13.5px] text-ink-2">
        Connect the wallet linked to your organisation, <span className="font-mono text-ink">{short(primary.address, 6, 6)}</span>, to sign.
      </p>
      {mismatch && (
        <p className="mt-2 text-[13px] text-warn">
          The connected wallet is {short(connectedAddr, 4, 4)}. Switch accounts in your wallet, or{" "}
          <button type="button" className="underline" onClick={() => disconnect()}>
            disconnect
          </button>
          .
        </p>
      )}
      {!connected && options.length === 0 && (
        <p className="mt-2 text-[13px] text-ink-3">No Solana wallet detected in this browser. Install Phantom or Solflare, or allow it on this site.</p>
      )}
      {!connected && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((x) => {
            return (
              <button
                key={x.adapter.name}
                type="button"
                disabled={connecting}
                onClick={() => {
                  setError(null);
                  setTarget(x.adapter.name);
                  select(x.adapter.name);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                <img src={x.adapter.icon} alt="" className="size-4 rounded" />
                {connecting && target === x.adapter.name ? "Connecting…" : `Connect ${x.adapter.name}`}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-loss-text">{error}</p>}
    </div>
  );
}
