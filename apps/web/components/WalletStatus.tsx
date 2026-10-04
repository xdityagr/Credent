"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export default function WalletStatus() {
  const { connected, publicKey } = useWallet();

  if (!connected || !publicKey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/50">Wallet status</p>
        <p className="mt-2 text-lg">Not connected</p>
      </div>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm text-white/50">Wallet status</p>

      <div className="mt-3">
        <p className="text-lg font-medium">Connected</p>

        <p className="mt-2 break-all font-mono text-sm text-white/60">
          {address}
        </p>
      </div>
    </div>
  );
}