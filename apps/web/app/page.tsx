"use client";

import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import WalletStatus from "@/components/WalletStatus";
import { createMockAgeCredential } from "@/lib/mockCredential";

export default function Home() {
  const { connected, publicKey } = useWallet();

  const walletAddress = publicKey?.toBase58();

  const credential = useMemo(() => {
    if (!walletAddress) {
      return null;
    }

    return createMockAgeCredential(walletAddress);
  }, [walletAddress]);

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
      <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
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

        {/* Wallet */}
        <div className="mt-12 w-full max-w-xl">
          <WalletStatus />
        </div>

        {/* Credential */}
        {connected && credential ? (
          <div className="mt-6 w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/40">Credential</p>

                <h2 className="mt-2 text-xl font-medium">
                  Age Verification
                </h2>
              </div>

              <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-400">
                Valid
              </span>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Type</span>

                <span className="font-mono text-xs">
                  {credential.type}
                </span>
              </div>

              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Credential ID</span>

                <span className="max-w-[250px] break-all text-right font-mono text-xs text-white/70">
                  {credential.id}
                </span>
              </div>

              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Issuer</span>

                <span className="max-w-[250px] break-all text-right font-mono text-xs text-white/70">
                  {credential.issuer}
                </span>
              </div>

              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Subject wallet</span>

                <span className="max-w-[250px] break-all text-right font-mono text-xs text-white/70">
                  {credential.subject.id}
                </span>
              </div>

              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Date of Birth</span>

                <span className="font-mono text-xs">
                  {credential.claims.dateOfBirth}
                </span>
              </div>

              <div className="flex items-start justify-between gap-6">
                <span className="text-white/40">Issued</span>

                <span className="text-white/70">
                  {new Date(
                    credential.issuedAt
                  ).toLocaleDateString()}
                </span>
              </div>

              {credential.expiresAt && (
                <div className="flex items-start justify-between gap-6">
                  <span className="text-white/40">Expires</span>

                  <span className="text-white/70">
                    {new Date(
                      credential.expiresAt
                    ).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Privacy message */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
              <p className="text-sm font-medium">
                🔐 Privacy layer coming next
              </p>

              <p className="mt-2 text-xs leading-5 text-white/40">
                The credential is now associated with the connected wallet.
                The next step is to prove the age requirement without revealing
                the underlying date of birth.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 w-full max-w-xl rounded-2xl border border-dashed border-white/10 p-8">
            <p className="text-sm text-white/40">
              Connect your wallet to view your credential.
            </p>
          </div>
        )}

        {/* Technology */}
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