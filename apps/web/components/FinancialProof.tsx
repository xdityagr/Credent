"use client";

import { useState } from "react";
import { createCommitment } from "../lib/crypto/commitment";
import { generateNonce } from "../lib/crypto/nonce";
import { verifyFinancialProof } from "../lib/crypto/verify";

export default function FinancialProof() {
  const [commitment, setCommitment] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // PRIVATE DATA
  // This value never appears in the UI.
  const privateRevenue = 1250000;

  // PUBLIC CLAIM
  const revenueThreshold = 1000000;

  async function generateProof() {
    setLoading(true);
    setVerified(null);

    try {
      // Generate a fresh random nonce.
      const nonce = generateNonce();

      // Create commitment from the private value + nonce.
      const generatedCommitment = await createCommitment(
        String(privateRevenue),
        nonce
      );

      setCommitment(generatedCommitment);

      // Verify the generated commitment.
      const isValid = await verifyFinancialProof({
        claim: `Annual revenue >= $${revenueThreshold.toLocaleString()}`,
        value: privateRevenue,
        nonce,
        commitment: generatedCommitment,
      });

      setVerified(isValid);
    } catch (error) {
      console.error("Financial proof generation failed:", error);
      setVerified(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        width: "100%",
        border: "1px solid #242424",
        borderRadius: "22px",
        padding: "40px",
        background: "#050505",
      }}
    >
      {/* Header */}
      <div
        style={{
          color: "#777",
          fontSize: "14px",
          letterSpacing: "4px",
          marginBottom: "25px",
        }}
      >
        PRIVATE FINANCIAL CREDENTIAL
      </div>

      <h2
        style={{
          fontSize: "36px",
          margin: "0 0 18px",
          fontWeight: 600,
        }}
      >
        Prove your revenue threshold.
      </h2>

      <p
        style={{
          color: "#777",
          fontSize: "18px",
          marginBottom: "40px",
        }}
      >
        Credent verifies your financial claim without exposing the underlying
        financial data.
      </p>

      {/* Claim */}
      <div
        style={{
          border: "1px solid #242424",
          borderRadius: "18px",
          padding: "30px",
          marginBottom: "25px",
        }}
      >
        <div
          style={{
            color: "#777",
            fontSize: "14px",
            marginBottom: "14px",
          }}
        >
          CLAIM
        </div>

        <div
          style={{
            fontSize: "25px",
            fontWeight: 600,
          }}
        >
          Annual revenue ≥ ${revenueThreshold.toLocaleString()}
        </div>
      </div>

      {/* Generate proof */}
      <button
        onClick={generateProof}
        disabled={loading}
        style={{
          width: "100%",
          padding: "20px",
          borderRadius: "14px",
          border: "none",
          background: "#fff",
          color: "#000",
          fontSize: "18px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Generating proof..." : "Generate Financial Proof"}
      </button>

      {/* Verification result */}
      {commitment && (
        <div
          style={{
            marginTop: "30px",
            border: "1px solid #242424",
            borderRadius: "18px",
            padding: "30px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: 600,
              marginBottom: "30px",
            }}
          >
            <span
              style={{
                color: verified ? "#00e676" : "#ff4444",
                marginRight: "12px",
              }}
            >
              {verified ? "✓" : "✕"}
            </span>

            {verified
              ? "Financial claim verified"
              : "Financial claim invalid"}
          </div>

          <div
            style={{
              color: "#777",
              fontSize: "14px",
              marginBottom: "12px",
            }}
          >
            COMMITMENT
          </div>

          <div
            style={{
              color: "#aaa",
              fontSize: "14px",
              wordBreak: "break-all",
              lineHeight: 1.6,
            }}
          >
            {commitment}
          </div>

          <div
            style={{
              color: "#666",
              marginTop: "25px",
              fontSize: "15px",
            }}
          >
            The underlying financial value was not exposed.
          </div>

          {verified && (
            <div
              style={{
                marginTop: "25px",
                paddingTop: "20px",
                borderTop: "1px solid #222",
                color: "#00e676",
                fontSize: "14px",
              }}
            >
              ✓ Commitment independently reproduced and verified.
            </div>
          )}
        </div>
      )}
    </section>
  );
}