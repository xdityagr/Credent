# Credent

### Privacy-Preserving Verifiable Credentials for the Web

Credent transforms real-world and Web2 identity signals into **privacy-preserving, cryptographically verifiable credentials**.

Instead of asking users to expose their complete personal data, Credent allows them to prove specific claims — such as employment, education, contribution history, or professional experience — without revealing unnecessary underlying information.

---

## 🚀 The Problem

Today, proving who you are or what you've achieved online usually requires sharing far more information than necessary.

For example, to prove:

> "I have more than 3 years of professional experience."

A user may have to share:

- Full LinkedIn profile
- Employment history
- Personal information
- Email
- Other unrelated profile data

This creates unnecessary privacy and trust risks.

---

## 💡 The Solution

Credent creates a privacy-first verification layer between **Web2 data, zero-knowledge proofs, and blockchain credentials**.

The core flow is:

```text
Web2 Data
    ↓
zkTLS / Secure Data Verification
    ↓
Zero-Knowledge Proof
    ↓
Verified Claim
    ↓
Credent Credential
    ↓
Solana
    ↓
Third-Party Verification
```

Instead of revealing the underlying data, users can prove **only what is necessary**.

Example:

```text
Private Data:
GitHub Contributions = 537

Public Claim:
Contributions ≥ 100

Verifier:
✅ Valid
```

The verifier learns that the user satisfies the requirement, without needing to know the exact private value.

---

## 🔐 Core Principles

### Privacy First

Raw personal data should never need to be stored on-chain.

### Verifiable

Credentials are backed by cryptographic proofs rather than relying purely on trust.

### Portable

Users can carry their credentials across applications and platforms.

### User Controlled

The user controls access to their credentials through their wallet.

### On-Chain Verification

Solana provides a tamper-resistant layer for credential commitments and verification.

---

# 🏗️ Architecture

```text
                         ┌─────────────────┐
                         │      USER       │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   CREDENT WEB   │
                         │    FRONTEND     │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
             ┌─────────────┐            ┌─────────────┐
             │   Web2 Data │            │    Wallet   │
             │ GitHub/etc. │            │   Solana    │
             └──────┬──────┘            └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │   zkTLS /   │
             │ Data Proof  │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ ZK Circuit  │
             │             │
             │ Prove claim │
             │ privately   │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ ZK Verifier │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │  Credential │
             │   Issuance  │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │   Solana    │
             │   Program   │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │   Verifier  │
             │ DAO / dApp  │
             │ Company     │
             └─────────────┘
```

---

# 🧩 Example

Imagine Alice wants to prove that she has made at least **100 GitHub contributions**.

### Traditional approach

Alice shares her entire GitHub profile.

The verifier receives:

```text
Username
Repositories
Contribution history
Profile information
Activity
Other public/private information
```

### Credent approach

Alice generates a proof:

```text
Contribution count ≥ 100
```

The verifier receives:

```text
Claim: GitHub contributions ≥ 100
Proof: Valid
```

The exact underlying data does not need to be revealed.

---

# 🔄 Credential Lifecycle

```text
1. Connect Data Source
        ↓
2. Verify Source Data
        ↓
3. Generate ZK Proof
        ↓
4. Verify Proof
        ↓
5. Create Credential
        ↓
6. Anchor Commitment on Solana
        ↓
7. Share Credential
        ↓
8. Third Party Verifies
        ↓
9. Credential Can Be Revoked/Expired
```

---

# 🛠️ Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Solana Wallet Adapter

## Backend

- Node.js
- TypeScript
- REST API
- PostgreSQL

## Blockchain

- Solana
- Anchor
- Rust

## Privacy

- Zero-Knowledge Proofs
- zkTLS
- ZK Circuits
- Cryptographic commitments

## Infrastructure

- Vercel
- Docker
- PostgreSQL

---

# 📁 Repository Structure

```text
credent/
│
├── apps/
│   ├── web/                  # Credent frontend
│   └── api/                  # Backend API
│
├── programs/
│   └── credent/              # Solana / Anchor program
│
├── circuits/
│   └── credentials/          # Zero-knowledge circuits
│
├── packages/
│   ├── types/                # Shared TypeScript types
│   ├── crypto/               # Cryptographic utilities
│   ├── sdk/                  # Credent developer SDK
│   └── config/               # Shared configuration
│
├── tests/
│   ├── api/
│   ├── circuits/
│   ├── solana/
│   └── integration/
│
├── docs/
│
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

# ⚡ Getting Started

## Prerequisites

Make sure you have:

- Node.js
- pnpm
- Rust
- Solana CLI
- Anchor
- Git
- Docker

---

## Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/credent.git

cd credent
```

Install dependencies:

```bash
pnpm install
```

---

## Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

Example:

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet

SOLANA_RPC_URL=
DATABASE_URL=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

JWT_SECRET=
```

Never commit `.env` files containing secrets.

---

# 🧪 Development

Start the frontend:

```bash
pnpm dev:web
```

Start the API:

```bash
pnpm dev:api
```

Run tests:

```bash
pnpm test
```

---

# ⛓️ Solana Development

Credent currently targets **Solana Devnet** during development.

Build the Anchor program:

```bash
anchor build
```

Run local tests:

```bash
anchor test
```

Deploy to Devnet:

```bash
anchor deploy
```

---

# 🔐 Privacy Model

Credent follows a simple principle:

> **Prove the claim, not the data.**

Sensitive data should remain off-chain whenever possible.

For example:

```text
PRIVATE
────────────────────────
GitHub contribution count
Employment history
Education records
Personal information
        │
        ▼
   ZK Circuit
        │
        ▼
PUBLIC
────────────────────────
Proof
Credential commitment
Credential status
Verification result
```

No raw personal information is intended to be stored directly on the Solana blockchain.

---

# 🧠 Zero-Knowledge Example

Suppose:

```text
Private input:
experience = 5 years
```

The circuit checks:

```text
experience >= 3
```

The proof only establishes:

```text
5 >= 3
```

The verifier learns:

```text
✅ User has at least 3 years of experience
```

without necessarily learning:

```text
❌ User has exactly 5 years
```

---

# 🌐 zkTLS

zkTLS is intended to provide a cryptographic bridge between Web2 services and privacy-preserving verification.

Conceptually:

```text
Web2 Website/API
       ↓
TLS Session
       ↓
zkTLS Proof
       ↓
Verified Data
       ↓
ZK Circuit
       ↓
Private Credential
```

This allows Credent to move beyond simply trusting an API response and toward **cryptographically verifiable Web2 claims**.

---

# ⛓️ Why Solana?

Credent uses Solana for the on-chain credential layer because it provides:

- Low transaction costs
- Fast confirmation
- Programmability
- Wallet-based identity
- Composability with Solana applications

The blockchain is **not used as a database for personal information**.

Instead, it acts as a verifiable coordination and ownership layer.

---

# 🔎 Verification

A third-party application can verify a credential without accessing the user's entire underlying dataset.

Example:

```text
Application
     │
     ▼
Credent
     │
     ▼
Credential
     │
     ▼
ZK Proof Verification
     │
     ▼
Solana State / Commitment
     │
     ▼
      ✅ Valid
```

---

# 🔄 Revocation

Credentials may need to become invalid.

Credent supports the concept of:

```text
ACTIVE
   │
   ├── EXPIRED
   │
   └── REVOKED
```

A verifier should check the credential status before accepting a credential.

---

# 🗺️ Roadmap

## Phase 1 — MVP

- [x] Project architecture
- [ ] GitHub repository
- [ ] Frontend
- [ ] Solana wallet connection
- [ ] GitHub integration
- [ ] Credential generation
- [ ] Credential hashing
- [ ] Solana Devnet program
- [ ] Credential verification

## Phase 2 — Privacy

- [ ] ZK circuit
- [ ] ZK proof generation
- [ ] ZK proof verification
- [ ] Private credential claims
- [ ] Credential commitments

## Phase 3 — Web2 Verification

- [ ] zkTLS integration
- [ ] Cryptographic Web2 data verification
- [ ] Multiple data sources
- [ ] Privacy-preserving claim extraction

## Phase 4 — Ecosystem

- [ ] Credent SDK
- [ ] Developer API
- [ ] Credential revocation
- [ ] Credential expiration
- [ ] Third-party integrations
- [ ] Mainnet deployment

---

# 🎯 Vision

Credent aims to become a **privacy-preserving verification layer for the internet**.

Instead of repeatedly sharing personal documents and profiles, users should be able to carry cryptographically verifiable proofs of the things they have achieved.

```text
Today's Internet

"Show me everything."

            ↓

Credent

"Prove only what I need to know."
```

---

# 🔭 Future Use Cases

Credent can potentially support credentials for:

- Developer reputation
- Employment
- Education
- Professional experience
- DAO membership
- Community reputation
- Financial eligibility
- On-chain reputation
- Skill verification
- Access control
- Sybil resistance

---

# 🤝 Contributing

Contributions are welcome.

```bash
git checkout -b feature/your-feature

git add .

git commit -m "feat: add your feature"

git push origin feature/your-feature
```

Then open a Pull Request.

---

# ⚠️ Status

Credent is currently an **early-stage experimental project**.

The architecture and cryptographic components are under active development and should not yet be considered production-ready.

---

# 📜 License

License information will be added as the project progresses.

---

## Built with privacy in mind.

**Credent — Prove more. Reveal less.**
