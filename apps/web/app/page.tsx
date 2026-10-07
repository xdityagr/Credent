"use client";

import ConnectWalletButton from "../components/ConnectWalletButton";
import WalletStatus from "../components/WalletStatus";
import FinancialProof from "../components/FinancialProof";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          height: "88px",
          borderBottom: "1px solid #1d1d1d",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}
      >
        {/* Credent Logo */}
        <div
          style={{
            fontSize: "30px",
            fontWeight: 800,
            letterSpacing: "-1.5px",
          }}
        >
          credent
          <span style={{ color: "#00d9ff" }}>.</span>
        </div>

        <ConnectWalletButton />
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "105px 24px 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#777",
            fontSize: "15px",
            letterSpacing: "6px",
            fontWeight: 500,
            marginBottom: "38px",
          }}
        >
          PRIVACY-PRESERVING BUSINESS CREDIT
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "76px",
            lineHeight: "0.98",
            letterSpacing: "-4px",
            fontWeight: 800,
          }}
        >
          Prove your
          <br />
          creditworthiness.
        </h1>

        <h2
          style={{
            margin: "12px 0 0",
            fontSize: "76px",
            lineHeight: "0.98",
            letterSpacing: "-4px",
            fontWeight: 800,
            color: "#555",
          }}
        >
          Without exposing your
          <br />
          finances.
        </h2>

        <p
          style={{
            maxWidth: "780px",
            margin: "48px auto 0",
            color: "#8b8b8b",
            fontSize: "20px",
            lineHeight: 1.55,
          }}
        >
          Credent enables businesses to prove financial claims to lenders
          without revealing their underlying financial data.
        </p>

        {/* Wallet */}
        <div style={{ marginTop: "65px" }}>
          <WalletStatus />
        </div>

        {/* Financial Proof */}
        <div
          style={{
            marginTop: "30px",
            textAlign: "left",
          }}
        >
          <FinancialProof />
        </div>
      </section>
    </main>
  );
}