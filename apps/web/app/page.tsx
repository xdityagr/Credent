"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-8 py-6">
        <div className="text-2xl font-semibold tracking-tight">
          credent<span className="text-white/40">.</span>
        </div>
        
          <ConnectWalletButton />
      </nav>

      <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-white/10 px-4 py-2 text-sm text-white/50">
          Privacy-preserving identity
        </div>

        <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Prove more.
          <br />
          <span className="text-white/40">Reveal less.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-white/50">
          Credent transforms Web2 data into cryptographically verifiable
          credentials without exposing unnecessary personal information.
        </p>

        <div className="mt-10 flex gap-4">
          <button className="rounded-full bg-white px-7 py-3 font-medium text-black transition hover:bg-white/80">
            Get Started
          </button>

          <button className="rounded-full border border-white/20 px-7 py-3 font-medium transition hover:bg-white/10">
            Learn More
          </button>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          <Feature
            title="Private"
            description="Prove specific claims without exposing your underlying personal data."
          />

          <Feature
            title="Verifiable"
            description="Cryptographic proofs replace blind trust in identity claims."
          />

          <Feature
            title="On-chain"
            description="Credentials can be anchored and verified through Solana."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-xl font-medium">{title}</h2>

      <p className="mt-4 leading-7 text-white/50">
        {description}
      </p>
    </div>
  );
}