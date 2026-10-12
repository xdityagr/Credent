# Credent — Private Credit, Public Book

**Status:** Draft for review · **Date:** 2026-10-12 · **Target:** hackathon demo

> zkTLS or payment-receipt history proves revenue; repayment sweeps from incoming
> flows before the borrower touches them. Loan book, tranching and default
> waterfall are public while borrower financials stay private. Goldfinch's idea
> with the transparency inverted.

## 1. Intent

### What the user asked for
- Turn the current half-built credential demo into a revenue-based private-credit protocol.
- Python for all backend logic and processing. Next.js for a polished frontend.
- Hackathon/demo grade: convincing end-to-end on one machine, real cryptography and real
  financial math, external rails (zkTLS, payment processors, USDC) simulated behind clean interfaces.
- Public layer: Python-owned hash-chained ledger, with block roots anchored to Solana devnet.
- Four flows must work end-to-end: borrower onboarding, lender deposits, revenue sweep + repayment,
  default + waterfall.

### Success criteria
1. A judge can run one setup command plus `dev` and walk all four flows in the browser in under 5 minutes.
2. Revenue proofs are real Noir/UltraHonk proofs that anyone can re-verify from the explorer.
3. No public endpoint ever returns raw borrower revenue, transactions, or receipts. A test enforces this.
4. Every ledger event is hash-chained. Block roots appear on Solana devnet with clickable explorer links
   (anchoring degrades gracefully if devnet is unreachable).
5. Sweep, amortization and waterfall math are covered by unit tests, including the edge cases in §6.

### Assumptions (call out if wrong)
- The existing Next.js app is rebuilt rather than patched. The old TS crypto/issuer/mock code is deleted.
- Money is simulated "demo USDC" tracked in the ledger. No SPL tokens move.
- The server acts as notary and prover for the demo. §10 notes the production path (client-side proving).
- Lender withdrawals, multiple pools, governance and KYC are out of scope.

## 2. Current state (what we're replacing)

| Piece | Disposition |
|---|---|
| `circuits/financial_proof` (Noir, Pedersen commitment, `revenue ≥ threshold`) | **Evolve** into `circuits/revenue_proof` (§5) |
| `apps/web` wallet adapter setup | **Keep** (Phantom), restyle |
| `apps/web/app/api/*`, `lib/crypto`, `lib/issuer`, `lib/zk`, `lib/mock*`, `types/` | **Delete** (logic moves to Python) |
| `scripts/prove-financial-proof.ps1` (hardcoded WSL paths of another machine, revenue fixed to 2.5M) | **Delete** (replaced by Docker prover) |
| `scripts/generate-issuer-keys.mjs` | **Delete** (Python generates keys on first run) |
| `README.md` (describes old generic-credential idea) | **Rewrite** |

## 3. Architecture

```
┌──────────────────────── apps/web (Next.js 16, Tailwind 4) ────────────────────────┐
│  /            landing + live pool stats                                           │
│  /borrow      onboarding wizard → private borrower dashboard (lockbox)            │
│  /lend        tranche cards, deposit, positions                                    │
│  /explorer    public loan book, tranches, waterfall, ledger, proofs, anchors       │
│  demo dock    sim controls (advance time, inject payments, default, recover)      │
└───────────────┬───────────────────────────────────────────┬───────────────────────┘
                │ REST (JSON)                                │ SSE /public/stream
┌───────────────▼────────────────────────────────────────────▼───────────────────────┐
│ apps/api  (FastAPI, Python 3.13, SQLite via SQLModel)                              │
│                                                                                    │
│  auth      wallet sign-in (ed25519 challenge) + demo-wallet fallback               │
│  sources   mock Stripe/bank feed · signed payment-receipt parser                   │
│  notary    simulated zkTLS notary: signs commitment over attested revenue          │
│  zk        Prover interface → DockerNoirProver / LocalNoirProver                   │
│  credit    underwriting: verified proof → credit line → drawdown → loan            │
│  sweep     lockbox: incoming flows → installment first → remainder to borrower     │
│  pool      tranches, share accounting, interest & loss waterfall                   │
│  ledger    append-only hash-chained events, blocks, Merkle roots                   │
│  anchor    post block roots to Solana devnet (Memo program)                        │
│  sim       clock, seeded scenario, payment generator, default trigger              │
│  public    read-only views that serialize ONLY public fields                       │
└───────────────┬───────────────────────────────────────────┬───────────────────────┘
                │ subprocess                                 │ JSON-RPC
       ┌────────▼─────────┐                         ┌────────▼────────┐
       │ prover container │  nargo + bb (pinned)    │ Solana devnet   │
       │ circuits/ mounted│                         │ Memo program    │
       └──────────────────┘                         └─────────────────┘
```

**Unit rule:** `pool`, `sweep`, and the amortization part of `credit` are pure functions over
dataclasses with no DB and no I/O. Services load state, call the pure core, persist the results,
and emit ledger events. This keeps the financial core small and exhaustively testable.

### Repository layout
```
apps/api/            pyproject.toml (uv), credent/ (modules above), tests/
apps/web/            Next.js app
circuits/revenue_proof/
infra/prover/Dockerfile
scripts/dev.ps1, scripts/dev.sh     start api + web together
docs/superpowers/specs/
```

## 4. Privacy model

| Data | Where it lives | Public? |
|---|---|---|
| Daily revenue series, transactions, receipts | `private_*` tables, borrower-auth endpoints only | **Never** |
| Revenue commitment (Pedersen hash) | ledger | Yes |
| Proof, verification key, public inputs (threshold, commitment) | ledger + `/public/proofs` | Yes |
| Notary attestation (source type, period, commitment, signature) | ledger | Yes (no account identifiers; account is a salted hash) |
| Borrower identity | pseudonym `BRW-xxxx` plus wallet address | Pseudonym yes, real name never stored |
| Loan terms (principal, APR, term, installment), status, installment paid/missed | ledger | Yes |
| Individual incoming payments and sweep remainders | private | **Never** |
| Tranche balances, NAV, share price, interest/loss allocations | ledger | Yes |

**Why the sweep uses fixed installments, not a percentage of revenue:** a percentage sweep would
publish repayment amounts from which revenue can be recovered (`revenue = repaid / rate`). With a
fixed installment, the public sees only "installment due X, paid in full / short by Y". That leaks
at most "revenue that period ≥ X", which is the same kind of statement the proof already makes.
This is the inverted-transparency design in practice.

**Known, accepted leakage:** the credit limit is derived from the proven threshold, so the threshold
is public by design. Payment status per epoch is public.

**Enforcement:** public endpoints serialize through explicit `Public*` Pydantic models (allow-list,
not deny-list). A test seeds the full scenario, crawls every `/public/*` route plus the SSE stream,
and asserts no raw revenue value, transaction id or receipt id appears anywhere.

## 5. Revenue proof (zkTLS-simulated + receipts → Noir)

### Sources (both produce the same thing: a 90-day daily revenue series in cents)
1. **"Connect Stripe" (simulated zkTLS).** `sources.mock_stripe` generates a seeded, realistic
   90-day transaction history for the borrower's chosen business profile (SaaS / e-commerce /
   agency). In real zkTLS the notary witnesses the TLS session. Here the notary module receives the
   series directly and records `source="stripe-zktls-sim"`.
2. **Payment-receipt upload.** The user uploads a CSV/JSON of receipts, each carrying an ed25519
   signature from a "payment processor" key that the API publishes. The parser rejects any receipt
   with a bad signature, duplicate id, or out-of-period date, then buckets the rest into daily
   totals. The demo includes a "download sample receipts" button (valid signed file) and a tampered
   sample to show rejection.

### Circuit `circuits/revenue_proof`
```noir
global DAYS: u32 = 90;
fn main(daily: [u64; DAYS], salt: Field, threshold: pub u64) -> pub Field {
    let mut total: u64 = 0;
    for i in 0..DAYS { total += daily[i]; }   // u64 overflow is a constraint failure
    assert(total >= threshold);
    let mut inputs: [Field; DAYS + 1] = [0; DAYS + 1];
    for i in 0..DAYS { inputs[i] = daily[i] as Field; }
    inputs[DAYS] = salt;
    std::hash::pedersen_hash(inputs)          // public output = commitment
}
```
Noir tests: a passing threshold, a failing threshold, and a commitment that changes when any day changes.

### Flow
1. **Commit.** The notary runs the prover in *execute-only* mode with `threshold = 0` to obtain the
   commitment for (series, salt). It then signs
   `{source, period_start, period_end, account_hash, commitment}` with the notary ed25519 key → attestation.
2. **Prove.** The borrower picks a threshold, and the UI suggests the largest round number ≤ the
   true total. `bb prove` generates the proof. The public inputs are `[threshold, commitment]`.
3. **Verify (server, at underwriting).** `bb verify` passes, the commitment in the public inputs
   equals the attested commitment, and the notary signature is valid. Only then is a credit line opened.
4. **Re-verify (anyone).** `/public/proofs/{id}/verify` re-runs `bb verify` on stored artifacts.
   The explorer also shows the notary signature check.

### Prover runtime
- `Prover` protocol: `commit(series, salt) -> commitment`, `prove(series, salt, threshold) -> ProofArtifacts`,
  `verify(artifacts) -> bool`.
- `DockerNoirProver` (default) runs a pinned `nargo` + `bb` image from `infra/prover/Dockerfile`.
  Each call uses a unique temp workdir so concurrent proofs don't clobber `Prover.toml`.
- `LocalNoirProver` is used when `nargo` and `bb` are on PATH (Linux/macOS/WSL).
- The circuit is compiled once at image build. The VK is generated once and cached.
- **No fake-proof fallback.** If no prover is available, the API returns 503 with setup
  instructions and the UI shows them. Exact `bb` CLI flags are pinned and verified in the plan's
  first task, because the CLI has changed across versions.

## 6. Lending mechanics

### Units and time
- All amounts are integer **cents** (`int`). No floats in money paths. Rates are basis points.
- Sim clock is in days. **Epoch** = 7 days. Interest accrues per epoch.

### Pool and tranches (one pool: "Credent Revenue Pool I")
| | Senior | Junior |
|---|---|---|
| Target APR | 9% (fixed coupon) | residual (variable) |
| Loss position | last | **first-loss** |
| Constraint | senior capital ≤ 4 × junior capital (deposits rejected otherwise) | — |

- Lenders receive tranche **shares**. `share_price = tranche_nav / shares`. Deposits mint at the current price.
- Pool cash = deposits − drawdowns + collections. Drawdowns require `pool_cash ≥ amount`.

### Underwriting → credit line → loan
- `credit_limit = 40% × proven_threshold` (threshold covers 90 days, so the limit is ≈ 1.6 months of revenue at most).
- Loan terms (fixed for the demo): APR 18%, term 12 epochs, level amortizing weekly installment
  computed with integer math. The final installment absorbs rounding so the principal repays exactly.
- `credit.amortize(principal, apr_bps, epochs) -> list[Installment(interest, principal)]` is pure.

### Sweep (lockbox)
Every incoming customer payment lands in the borrower's lockbox. For each payment, in order:
1. Fill the **current installment due** (plus any arrears carried from earlier epochs) first.
2. Release the remainder to the borrower's operating balance (private).

At epoch close:
- If the installment is fully swept, emit `InstallmentPaid` (public, amount only).
- Otherwise emit `InstallmentShort {due, paid, shortfall}`, carry the shortfall to arrears, and set the
  loan to `LATE`. **3 consecutive short epochs** sets the loan to `DEFAULTED`.

Pure function: `sweep.apply_payment(state, amount) -> (state', swept, released)`.
`sweep.close_epoch(state) -> (state', event)`.

### Interest waterfall (on each epoch's collections)
Collections split into interest and principal using the amortization schedule. Arrears are paid
interest-first. Then:
1. **Protocol fee:** 10% of interest collected.
2. **Senior coupon:** up to senior accrued coupon for the epoch, plus any senior arrears. Any
   shortfall carries forward as senior arrears.
3. **Junior:** all remaining interest.

Principal collections go back to pool cash. Tranche principal claims are unchanged.

### Loss waterfall (on default)
- `loss = outstanding_principal` at default. Hits **Junior NAV first** down to 0, and any excess
  hits **Senior NAV**. Emits `LossAllocated {junior, senior}`.
- **Recovery** (sim action, e.g. collateral or collections agency recovers N cents): restores Senior
  write-downs first, then Junior, and any excess goes to Junior as gain. Emits `RecoveryAllocated`.

### Required edge-case tests
- Payment exactly equals the installment. Payment split across several payments. A single payment
  covering arrears plus the current installment.
- Final-installment rounding sums exactly to principal.
- Loss smaller than junior NAV, equal to it, and larger than it (senior impaired). Loss larger than total NAV.
- Recovery smaller than the senior write-down, and recovery that overflows into junior gain.
- Senior coupon shortfall carried and later caught up.
- Subordination rejection at the exact 4× boundary.
- Balance-sheet identity at every step: `pool_cash + outstanding_principal == senior_nav + junior_nav`
  (protocol fees leave the pool to a treasury account). Property test with Hypothesis over random
  sequences of deposit / draw / payment / epoch-close / default / recovery.

## 7. Public ledger and Solana anchoring

- `ledger_events(seq, ts_sim_day, type, payload_json, prev_hash, hash)` where
  `hash = sha256(prev_hash ‖ seq ‖ type ‖ canonical_json(payload))`. Payloads are public-schema only.
- Writes happen through a single `ledger.append(event)` inside the same DB transaction as the state change.
- **Blocks:** at every epoch close (and on demand), the system seals a block containing the events since
  the last block, along with their Merkle root.
- **Anchor:** `anchor.post(block)` sends a Solana devnet transaction with a Memo instruction
  `credent:v1:block:<n>:<merkle_root>` using a server keypair (auto-created; airdrop requested on
  startup). It stores the signature and links to `explorer.solana.com/tx/<sig>?cluster=devnet`.
  Failure leaves the block `UNANCHORED`, and it is retried on the next seal. The UI shows the status
  honestly. `ANCHOR_ENABLED=false` disables anchoring for offline demos.
- `/public/ledger/verify` recomputes the whole hash chain and all Merkle roots and returns OK or the first bad seq.

## 8. API surface

**Auth**
- `POST /auth/challenge {wallet}` → nonce message
- `POST /auth/verify {wallet, signature}` → session token (ed25519 verify via PyNaCl)
- `POST /auth/demo {role}` → server-generated demo wallet plus session, so the demo works without Phantom

**Borrower** (auth)
- `POST /borrower/sources/stripe {profile}` returns a private series summary.
- `POST /borrower/sources/receipts` (file upload) does the same from receipts.
- `GET /borrower/sample-receipts?tampered=bool`
- `POST /borrower/attest` returns an attestation.
- `POST /borrower/prove {threshold}` returns a proof id. It is a long call: the server streams progress over SSE.
- `POST /borrower/credit-line` verifies, then returns the line.
- `POST /borrower/draw {amount}` returns the loan.
- `GET /borrower/me` is the private dashboard (revenue, lockbox, payments, sweeps).

**Lender** (auth)
- `POST /lender/faucet` grants demo USDC.
- `POST /lender/deposit {tranche, amount}`
- `GET /lender/positions`

**Public** (no auth)
- `GET /public/pool`, `/public/tranches`, `/public/loans`, `/public/loans/{id}`
- `GET /public/ledger?after=`, `/public/blocks`, `/public/ledger/verify`
- `GET /public/proofs/{id}`, `POST /public/proofs/{id}/verify`
- `GET /public/stream` (SSE of new public events)

**Sim** (enabled when `SIM_ENABLED=true`, the default in dev)
- `POST /sim/reset` reseeds the scenario: 3 borrowers (one healthy SaaS, one seasonal e-commerce, one that
  will default), 5 lenders, a funded pool, and 4 weeks of history.
- `POST /sim/advance {days}` generates each borrower's payments from their profile, runs sweeps,
  closes epochs, runs waterfalls and seals blocks.
- `POST /sim/payment {borrower, amount}`, `POST /sim/default {loan}`, `POST /sim/recover {loan, amount}`

**Errors:** domain errors (`InsufficientLiquidity`, `SubordinationBreach`, `ProofInvalid`,
`ProverUnavailable`, `ThresholdNotMet`, …) map to 4xx/503 with a stable `code` and a human
`message`. The UI shows the message as-is.

## 9. Frontend

- Stack: Next.js 16 App Router, Tailwind 4, TypeScript, existing Solana wallet adapter,
  a typed API client generated from FastAPI's OpenAPI (`openapi-typescript`), and SSE for live data.
  Charts are built with Recharts or similar, following the dataviz skill.
- **Visual concept: "inverted transparency."** Private data renders behind a frosted, redacted
  treatment that only the borrower can reveal. Public data renders crisp, monospaced and hash-linked.
  The explorer looks like a block explorer that has a balance sheet attached. Exact aesthetics are
  decided with the frontend-design skill during implementation.
- **Pages**
  - `/`: the pitch in one screen, live pool TVL / loans / default rate, and three role entry points
    (Borrow · Lend · Explore).
  - `/borrow`: a four-step wizard (Connect source → Notarize → Prove (live progress: compile ·
    witness · prove · verify) → Draw). Then a dashboard with a lockbox animation that shows each
    incoming payment splitting into "swept to pool" and "released to you", installment progress,
    and the private revenue chart.
  - `/lend`: Senior vs Junior cards (APR, NAV, share price, subordination meter, loss
    exposure), faucet, deposit, positions.
  - `/explorer`: loan book table, tranche NAV-over-time chart, waterfall diagram that animates on
    each allocation, ledger feed (hash, prev-hash, block, Solana anchor link), proof verifier, and a
    "verify entire chain" button.
  - **Demo dock:** a collapsible bottom bar on every page (when the sim is enabled) with buttons for
    +1 week, +4 weeks, inject payment, default borrower, recover, and reset.
- Every async action has loading, error and empty states. No silent failures.

## 10. Production path (documented, not built)
- Real zkTLS (Reclaim / TLSNotary / Opacity) replaces `mock_stripe` plus the notary module behind the same interface.
- Client-side proving with `noir_js` + `bb.js`, so raw revenue never leaves the borrower's device.
- Lockbox as a real controlled account (payment processor payout redirection or bank DACA) or as
  an on-chain program-owned USDC account.
- Pool and waterfall as an Anchor program, with the Python ledger becoming an indexer.

## 11. Testing and verification
- **pytest:** pure-core unit tests (§6 list), Hypothesis conservation property, ledger chain and
  Merkle tests, notary signature and receipt-parser tests, API integration tests with a `FakeProver`
  (deterministic, **test-only**, never wired in app config), and the privacy-crawl test (§4).
- **Real prover integration test:** marked `@pytest.mark.prover`, runs when Docker is available,
  and proves and verifies a real series end-to-end.
- **Noir:** `nargo test` in the prover image.
- **Web:** `tsc --noEmit`, `next build`, ESLint, then a scripted browser walkthrough of the four flows before calling the work done.

## 12. Setup and run
- `scripts/setup.(ps1|sh)` installs uv, runs `uv sync`, enables `corepack` (pnpm), runs `pnpm install`,
  and runs `docker build` for the prover image.
- `scripts/dev.(ps1|sh)` starts the API on :8000 and the web app on :3000, then calls `/sim/reset` on first run.
- `.env.example` documents `ANCHOR_ENABLED`, `SOLANA_RPC_URL`, `SIM_ENABLED`, and `PROVER=docker|local`.
