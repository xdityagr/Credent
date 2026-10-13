# Credent

### Private credit, public book.

Credent is a revenue-based credit marketplace on Solana.

- **Borrowers** prove revenue with zero-knowledge proofs. Lenders learn only "90-day revenue ≥ X", never the books.
- **Lender companies** run their own pools, with a senior tranche (fixed coupon, paid first) and a junior tranche (first loss, residual yield).
- **Repayment comes first.** Customer payments land in a lockbox that pays the weekly installment before anything reaches the business.
- **The book is public.** Loans, tranches, settlements and losses are on a hash-chained ledger anchored to Solana.
- **Money is real tokens.** It moves as cUSD SPL tokens, and users never need SOL because the protocol pays fees.

> Goldfinch's idea, with the transparency inverted.

## How it works

| Step | Who | What happens |
|---|---|---|
| Connect revenue | Borrower | Stripe (test-mode key), processor-signed receipts, or a demo business. A notary signs a Pedersen commitment to 90 daily totals. |
| Prove | Borrower | A Noir circuit proves `sum(daily) ≥ threshold` with an UltraHonk proof (Barretenberg). Only the threshold and commitment are public. |
| Run a pool | Lender | Create a pool with your terms: coupon, APR, advance rate, term, minimum proven revenue, auto-approve rules. Fund the first-loss junior tranche with a wallet-signed SPL transfer. Co-investors take senior. |
| Apply → approve → sign | Both | The borrower applies with a proof. The manager reviews it (or rules auto-approve it). The borrower signs the loan terms with their wallet, and cUSD moves vault → borrower. |
| Collect | Protocol | Incoming customer payments are swept into the installment first. The remainder becomes the borrower's operating balance, withdrawable to their wallet. |
| Settle | Protocol | Weekly per pool: fee → senior coupon → junior. Three short weeks is a default; losses hit junior first, recoveries restore senior first. Settlements move on-chain. |
| Verify | Anyone | Re-run any proof, recompute the hash chain, check each pool's vault against its book ("reserves verified"). |

**Privacy:**
- Raw revenue, customer payments and borrower identities never leave private tables.
- Public endpoints are allow-listed and covered by a crawl test.
- Inflows reach Solana once a day as **one aggregate across all borrowers**, so no business's revenue is visible on-chain.
- A pool manager sees who is applying, but never their revenue.

## Run it locally

Prerequisites: Python 3.12+, Node 20+, Docker Desktop.

```powershell
./scripts/setup.ps1   # uv + pnpm, deps, Postgres + Mailpit (docker compose), ZK prover image
./scripts/dev.ps1     # API :8000, web :3000
```
macOS/Linux: `scripts/setup.sh`, `scripts/dev.sh`.

- **Web:** http://localhost:3000. Sign up (the verification email lands in **Mailpit**, http://localhost:8025) or use **Try the demo** on the login page.
- **Demo world:** seeded on first boot.
  - Lenders: Harbor Credit Partners, Meridian Capital, and Atlas Family Office as a senior co-investor.
  - Borrowers: a SaaS company, a seasonal e-commerce brand, and a freight broker that defaults about four weeks in.
  - The clock advances one protocol day every 120 s (`SECONDS_PER_DAY`).

### Solana
| `CHAIN_MODE` | What runs |
|---|---|
| `local` (default) | Real SPL Token, ATA and Memo programs in an in-process Solana VM (LiteSVM). Phantom/Solflare signatures work. Balances are rebuilt from the database on restart. |
| `devnet` | Solana devnet with explorer links. Fund the fee payer once at https://faucet.solana.com: `cd apps/api && uv run python ../../scripts/devnet.py status` prints its address, `... devnet.py smoke` runs a round trip. |

## Deploy (Render + Vercel)

**API on Render.** `render.yaml` defines the API (Docker image with the Noir/Barretenberg prover built in) and its Postgres. In Render: **New → Blueprint**, pick this repo, and fill in `APP_URL`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`. `KEY_SECRET` is generated for you. Every custody, notary and anchor key derives from it, so keep it stable.

**Web on Vercel.** Import the repo with **Root Directory** `apps/web`, then set these environment variables:
- `API_URL`: your Render URL, e.g. `https://credent-api.onrender.com`;
- `NEXT_PUBLIC_SOLANA_RPC_URL`: `https://api.devnet.solana.com`;
- `ENABLE_EXPERIMENTAL_COREPACK`: `1`, so Vercel uses the pinned pnpm.

The browser only talks to same-origin `/api/*`, which Next rewrites to the API, so no CORS setup is needed.

Finally, set `APP_URL` on Render to the Vercel URL so email links point at the live site.

## Repository
```
apps/api/            FastAPI (Python): accounts, orgs, wallets, pools, applications, loans,
                     collections, settlement, funds, revenue (demo/receipts/Stripe), public book, jobs
  credent/core/      pure financial core: amortization, lockbox sweep, tranche waterfall
  credent/chain/     SPL instruction builders, custody, LiteSVM + RPC clients, rehydration
  credent/zk/        Noir/bb prover wrapper
  migrations/        Alembic
  tests/             pytest + Hypothesis + LiteSVM (run real proofs with -m prover)
apps/web/            Next.js 16 frontend
circuits/revenue_proof/   Noir circuit
infra/               docker-compose (Postgres, Mailpit), prover image
```

```bash
cd apps/api && uv run pytest              # unit, chain (LiteSVM), marketplace, API, privacy crawl
cd apps/api && uv run pytest -m prover    # real proofs via docker
```

**Status:** prototype on devnet/local chains with test-mode Stripe. Not audited. Don't use real funds.
