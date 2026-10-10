"use client";

import { useState } from "react";

interface ProofCredential {
  id: string;
  type: "BUSINESS_CREDIT";
  issuer: string;
  subject: {
    id: string;
  };
  claim: {
    type:
      | "MIN_REVENUE"
      | "MIN_CREDIT_SCORE"
      | "MAX_DEBT"
      | "MIN_BUSINESS_AGE"
      | "MAX_LATE_PAYMENTS";
    threshold: number;
  };
  proof: {
    proof: string;
    publicInputs: string;
    verificationKey: string;
  };
  issuedAt: string;
  expiresAt?: string;
}

interface CredentialResponse {
  success: boolean;
  credential?: ProofCredential;
  error?: string;
}

export default function FinancialProof() {
  const [loading, setLoading] = useState(false);
  const [credential, setCredential] =
    useState<ProofCredential | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateProof() {
    setLoading(true);
    setCredential(null);
    setError(null);

    try {
      const response = await fetch("/api/business-credential", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectId: "did:credent:demo-business",
        }),
      });

      const data: CredentialResponse = await response
        .json()
        .catch(() => ({
          success: false,
          error: "The server returned an invalid response.",
        }));

      if (!response.ok || !data.success || !data.credential) {
        throw new Error(
          data.error ||
            `Credential generation failed (HTTP ${response.status}).`
        );
      }

      setCredential(data.credential);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate financial proof."
      );
    } finally {
      setLoading(false);
    }
  }

  const threshold = credential?.claim.threshold ?? 1_000_000;

  return (
    <section className="w-full rounded-[28px] border border-white/10 bg-black p-12">
      <div className="mb-10">
        <p className="mb-8 text-sm tracking-[0.35em] text-white/50">
          PRIVATE FINANCIAL CREDENTIAL
        </p>

        <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Prove your revenue threshold
          <span className="text-yellow-400">.</span>
        </h2>

        <p className="mt-6 max-w-3xl text-lg text-white/50">
          Credent verifies your financial claim without
          exposing the underlying financial data.
        </p>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-black p-10">
        <p className="text-sm text-white/40">CLAIM</p>

        <p className="mt-6 text-2xl font-semibold text-white">
          Annual revenue ≥ $1,000,000
        </p>
      </div>

      <button
        onClick={generateProof}
        disabled={loading}
        className="mt-8 flex w-full items-center justify-center rounded-[18px] bg-white px-6 py-5 text-lg font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Generating Zero-Knowledge Proof..."
          : "Generate Financial Proof"}
      </button>

      {loading && (
        <div className="mt-8 rounded-[24px] border border-white/10 bg-black p-10">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />

            <p className="text-lg font-medium text-white">
              Generating financial credential
            </p>
          </div>

          <p className="mt-4 text-sm text-white/40">
            Credent is requesting the credential and proof
            from the server. The result will be displayed
            only after the server reports success.
          </p>
        </div>
      )}

      {credential && (
        <div className="mt-8 rounded-[24px] border border-white/10 bg-black p-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl text-green-400">✓</span>

            <p className="text-xl font-semibold text-white">
              Credential Generated Successfully
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <p className="text-sm text-white/40">
                VERIFIED CLAIM
              </p>

              <p className="mt-2 text-lg font-medium text-white">
                Revenue meets the required threshold
              </p>
            </div>

            <div>
              <p className="text-sm text-white/40">
                PUBLIC THRESHOLD
              </p>

              <p className="mt-2 text-lg font-medium text-white">
                ${threshold.toLocaleString("en-US")}
              </p>
            </div>

            <div>
              <p className="text-sm text-white/40">
                CREDENTIAL ISSUER
              </p>

              <p className="mt-2 text-lg font-medium text-white">
                {credential.issuer}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-6">
              <p className="text-sm font-medium text-green-400">
                Credential returned by server
              </p>

              <p className="mt-3 break-all text-sm leading-6 text-white/40">
                Credential ID: {credential.id}
              </p>

              <p className="mt-2 text-sm leading-6 text-white/40">
                Issued at: {credential.issuedAt}
              </p>

              <p className="mt-3 text-sm leading-6 text-white/40">
                This status confirms that the server returned
                a credential. It does not independently verify
                the cryptographic proof in the browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-[24px] border border-red-500/20 bg-black p-10">
          <p className="text-lg font-semibold text-red-400">
            Proof generation failed
          </p>

          <p className="mt-3 break-words text-sm text-white/50">
            {error}
          </p>
        </div>
      )}
    </section>
  );
}