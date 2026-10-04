"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import WalletStatus from "@/components/WalletStatus";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between border-b border-white/10 px-8 py-6">
        <div className="text-2xl font-semibold tracking-tight">
          credent<span className="text-white/40">.</span>
        </div>

        <ConnectWalletButton />
      </nav>

      {/* Hero */}
      <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          <p className="mb-6 text-sm uppercase tracking-[0.3em] text-white/40">
            Privacy-preserving identity
          </p>

          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Prove what you are.
            <br />
            <span className="text-white/40">
              Without exposing everything.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
            Credent is a privacy-first credential platform built on Solana.
            Verify claims about yourself without unnecessarily revealing your
            underlying personal data.
          </p>
        </div>

        {/* Wallet Status */}
        <div className="mt-12 w-full max-w-xl">
          <WalletStatus />
        </div>

        {/* Coming Soon */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50">
            Solana
          </span>

          <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50">
            Zero-Knowledge Proofs
          </span>

          <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50">
            Verifiable Credentials
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-6 text-center text-sm text-white/30">
        Credent — Privacy-preserving identity infrastructure
      </footer>
    </main>
  );
}