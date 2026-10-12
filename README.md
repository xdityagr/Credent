# Credent

### Private credit, public book.

> zkTLS or payment-receipt history proves revenue; repayment sweeps from incoming
> flows before the borrower touches them. Loan book, tranching and default
> waterfall are public while borrower financials stay private.
> **Goldfinch's idea, with the transparency inverted.**

In on-chain private credit today, lenders are asked to trust off-chain underwriting
they cannot see, and they can barely observe how the pool itself behaves. Credent
turns that around:

| | Typical private-credit protocol | Credent |
|---|---|---|
| Borrower revenue & transactions | shared with auditors / underwriters | **private**, proven with a zero-knowledge proof |
| Why the loan was approved | "trust the auditor" | public proof: `sum(90-day revenue) ≥ threshold`, verifiable by anyone |
| Repayment | borrower chooses to repay | **lockbox sweep**: incoming flows repay the installment first |
| Loan book, tranches, waterfall | opaque or delayed reporting | **public**, hash-chained, anchored to Solana |

---

## How it works

```
 Borrower                         Credent (Python)                         Public
 ────────                         ────────────────                         ──────
 Stripe / bank (zkTLS) ─┐
 or signed receipts  ───┼──▶ notary signs Pedersen commitment ──▶ AttestationRecorded
                        │         to 90 days of revenue
                        └──▶ Noir circuit proves                ──▶ ProofVerified
                             sum(daily) ≥ threshold                  (proof + vk downloadable,
                             (UltraHonk, bb)                          re-verifiable by anyone)
                                    │
                                    ▼
                             credit line = 40% × threshold      ──▶ CreditLineOpened
                             drawdown from the pool             ──▶ LoanDrawn
                                    │
 customer payments ──▶ LOCKBOX ─────┤ sweep: installment (+ arrears) first
                                    │ remainder released to borrower (private)
                                    ▼
                             weekly settlement                  ──▶ InstallmentPaid / Short
                             interest waterfall                 ──▶ InterestDistributed
                             (fee → senior coupon → junior)
                             3 short weeks → default            ──▶ LoanDefaulted
                             loss waterfall (junior → senior)   ──▶ LossAllocated
                             recoveries (senior → junior)       ──▶ RecoveryAllocated
                                    │
                                    ▼
                             hash-chained ledger → Merkle block ──▶ Solana devnet memo
                                                                     credent:v1:block:<n>:<root>
```

### The zero-knowledge proof
`circuits/revenue_proof/src/main.nr`

```noir
fn main(daily: [u64; 90], salt: Field, threshold: pub u64) -> pub Field {
    // assert(sum(daily) >= threshold); return pedersen_hash(daily ++ [salt])
}
```

- **Private inputs:** 90 daily revenue values and a random salt.
- **Public inputs:** the threshold and the commitment.
- The notary signs the commitment, never the numbers. At underwriting the API checks four things:
  1. The proof verifies.
  2. The public threshold equals the claimed threshold.
  3. The public commitment equals the notarized commitment.
  4. The notary's signature is valid.

  Anyone can re-run that check from the explorer.

### Privacy model
| Data | Public? |
|---|---|
| Daily revenue, customer payments, receipts, sweep remainders | **never** (separate `Private*` tables; public routes use allow-list schemas, and a test crawls every public route to enforce this) |
| Commitment, proof, verification key, threshold, notary signature | yes |
| Loan terms, installment status, tranche NAVs, waterfall allocations | yes |
| Borrower identity | pseudonym (`BRW-xxxxxx`) |

**Why fixed installments instead of a percentage-of-revenue sweep:** a percentage sweep would
publish `repaid / rate = revenue`. With fixed installments, a paid week reveals only that
"revenue ≥ installment".

**Accepted leakage:**
- The threshold is public, because the credit line is derived from it.
- A *short* week publishes the amount swept, which is that week's revenue. Delinquency gives up some privacy.

### Pool mechanics
| | Senior | Junior |
|---|---|---|
| Yield | 9% APR coupon, on its share of deployed capital | everything left after the fee and the senior coupon |
| Losses | last | **first** |
| Recoveries | first | after senior is made whole |
| Constraint | senior ≤ 4 × junior | — |

**Loans:**
- APR is 18%, repaid in 12 level weekly installments.
- Credit line is 40% of the proven 90-day revenue.
- The protocol fee is 10% of interest.
- 3 consecutive short weeks counts as a default.
- Balance-sheet identity, checked on every operation and property-tested:
  `cash + outstanding = senior NAV + junior NAV`

---

## Run it

**Prerequisites:** Python 3.12+, Node 20+, Docker Desktop (running).

```powershell
./scripts/setup.ps1   # uv + pnpm, deps, builds the Noir/bb prover image (~2 min first time)
./scripts/dev.ps1     # API on :8000, web on :3000
```
(macOS/Linux: `scripts/setup.sh` and `scripts/dev.sh`.)

On first boot the API seeds a demo world:
- 5 lenders, $1.8M of capital.
- 3 borrowers onboarded with **real** ZK proofs: a healthy SaaS company, a seasonal e-commerce brand, and a freight broker whose revenue collapses three weeks after drawdown.
- 4 weeks of history.

### Solana anchoring
The API derives an anchor wallet and shows it in `/public/status` and on the Explorer page.
Devnet airdrops are often rate-limited, so fund the address once at
<https://faucet.solana.com>. Until then, blocks show as `UNANCHORED` and are retried
automatically. Set `ANCHOR_ENABLED=false` for fully offline demos.

### Demo script (5 minutes)
1. **Borrow:** sign in with Phantom or a demo wallet, then connect "Stripe" (or upload the sample
   signed receipts; try the tampered file and see it rejected). Notarize, generate the proof
   (real UltraHonk, about 1 s), and draw.
2. **Lend:** get demo USDC from the faucet and deposit into Junior. Try to over-deposit into
   Senior and see the 4× subordination guard.
3. **Run time:** use the demo dock to advance +1 or +4 weeks. On the borrower dashboard,
   every customer payment splits into *swept to pool* and *released to you*.
4. **Default:** the freight broker misses three weeks and defaults. The explorer animates the loss
   hitting Junior first. Trigger a recovery and see Senior made whole first.
5. **Verify:**
   - Re-verify any proof in the browser (bb runs server-side over the stored artifacts).
   - Run "verify entire chain".
   - Follow a block to its Solana memo.

---

## Repository

```
apps/api/            FastAPI + SQLite (Python, uv)
  credent/core/      pure financial core: amortize, sweep, pool/waterfall
  credent/zk/        Noir/bb prover wrapper (docker or local)
  credent/notary.py  simulated zkTLS notary (ed25519)
  credent/ledger.py  hash-chained events, Merkle blocks
  credent/anchor.py  Solana devnet memo anchoring
  credent/services/  borrower, lender, sim, public read models
  tests/             pytest + Hypothesis (run prover tests with -m prover)
apps/web/            Next.js 16 frontend
circuits/revenue_proof/   Noir circuit
infra/prover/        pinned Noir 1.0.0-beta.22 + bb 5.0.0-nightly.20260522 image
docs/superpowers/    design spec and implementation plan
```

```bash
cd apps/api && uv run pytest              # unit, service, API, privacy tests
cd apps/api && uv run pytest -m prover    # real proofs through docker
```

## Production path (not built)
- **Real zkTLS** (TLSNotary / Reclaim / Opacity) behind the same notary interface.
- **Client-side proving** (`noir_js` + `bb.js`), so revenue never leaves the borrower's device.
- **Real lockbox:** payout redirection or a bank DACA, or a program-owned USDC account.
- **On-chain pool:** pool and waterfall as an Anchor program, with this ledger becoming its indexer.

---

**Status:** hackathon prototype. Money is simulated demo USDC. Not audited.
