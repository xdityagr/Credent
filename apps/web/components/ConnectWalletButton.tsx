"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function ConnectWalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-full border border-white/20 px-5 py-2 text-sm text-white"
      >
        Connect Wallet
      </button>
    );
  }

  return <WalletMultiButton />;
}