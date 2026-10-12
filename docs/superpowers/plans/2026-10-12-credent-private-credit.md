# Credent Private Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hackathon-grade revenue-based private-credit protocol. Borrowers prove revenue with real Noir ZK proofs, repayments sweep from incoming flows, and the loan book, tranches and waterfall are public on a hash-chained ledger anchored to Solana devnet.

**Architecture:** FastAPI modular monolith (`apps/api`). A pure financial core (`credent/core`) is wrapped by services that persist to SQLite and append to a hash-chained public ledger. A Docker-hosted Noir/bb prover is called through subprocess. The Next.js 16 frontend (`apps/web`) reads REST plus SSE.

**Tech Stack:** Python 3.13, uv, FastAPI, SQLModel/SQLite, Pydantic v2, PyNaCl, base58, solana-py/solders, sse-starlette, pytest, Hypothesis · Noir 1.0.0-beta.22 + bb 5.0.0-nightly.20260522 (Docker) · Next.js 16, React 19, Tailwind 4, Solana wallet adapter, Recharts.

**Spec:** `docs/superpowers/specs/2026-10-12-credent-private-credit-design.md`

## Global Constraints

- All money is integer cents (`int`). Rates are integer basis points. No floats in money paths.
- Epoch = 7 sim days. Senior coupon 900 bps. Senior NAV ≤ 4 × junior NAV. Protocol fee = 10% of interest.
- Credit limit = 40% of proven 90-day threshold. Loan APR 1800 bps. Term 12 epochs. 3 consecutive short epochs → DEFAULTED.
- Balance-sheet identity after every pool operation: `cash + outstanding == senior.nav + junior.nav`.
- Public endpoints serialize only through `Public*` models. Raw revenue, payments and receipts never appear publicly.
- No fake-proof fallback in app wiring. `FakeProver` exists only under `tests/`.
- Prover pins: Noir `1.0.0-beta.22`, bb `5.0.0-nightly.20260522`. Commands verified in the spike:
  `nargo execute` (prints `Circuit output: 0x…`), `bb write_vk -b <json> -o <dir>`,
  `bb prove -b <json> -w <gz> -k <vk> -o <dir>`, `bb verify -p proof -i public_inputs -k vk`.
  `public_inputs` = 64 bytes = `threshold(32B BE) ‖ commitment(32B)`.
- Ledger hash: `sha256(prev_hash ‖ str(seq) ‖ type ‖ canonical_json(payload))`. Genesis prev_hash = 64 zeros.
- Solana memo: `credent:v1:block:<n>:<merkle_root>`. Memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`.

## Review Focus

1. **Drawdown larger than remaining credit or pool cash:** must be rejected with `CREDIT_EXCEEDED` / `INSUFFICIENT_LIQUIDITY` and leave state unchanged. Test in Task 9.
2. **Proof whose public inputs don't match the attestation** (a valid proof for a different commitment or threshold): must be rejected as `PROOF_MISMATCH`. Test in Task 8.
3. **Payments arriving for a defaulted or repaid loan:** must be fully released to the borrower and never swept. Test in Task 3.
4. **Sim advance with zero loans or zero deposits:** must not divide by zero, and senior coupon must not accrue on idle capital. Tests in Tasks 4 and 10.
5. **Tampered ledger row:** `/public/ledger/verify` must report the first bad seq. Test in Task 6.

---

## File Map

```
apps/api/pyproject.toml
apps/api/credent/config.py          Settings (env)
apps/api/credent/errors.py          DomainError(code,status,message) + subclasses
apps/api/credent/core/amortize.py   Installment, amortize()
apps/api/credent/core/sweep.py      LoanState, apply_payment(), close_epoch()
apps/api/credent/core/pool.py       Tranche, Pool, deposit/draw/distribute/default/recover
apps/api/credent/crypto/keys.py     ed25519 keystore, sign/verify helpers
apps/api/credent/crypto/canonical.py canonical_json
apps/api/credent/crypto/merkle.py   merkle_root
apps/api/credent/sources/profiles.py business profiles + seeded daily revenue/payment generator
apps/api/credent/sources/receipts.py signed receipt make/parse
apps/api/credent/notary.py          Attestation, attest(), verify_attestation()
apps/api/credent/zk/encode.py       prover_toml(), parse_public_inputs()
apps/api/credent/zk/prover.py       ProofArtifacts, NoirProver(runner), DockerRunner, LocalRunner, get_prover()
apps/api/credent/db.py, models.py   SQLModel engine + tables
apps/api/credent/ledger.py          append(), seal_block(), verify_chain()
apps/api/credent/anchor.py          SolanaAnchor (background)
apps/api/credent/events.py          SSE broadcaster
apps/api/credent/services/*.py      auth, borrower, lender, pool_store, sim
apps/api/credent/api/*.py           app, deps, schemas (Public*), routes_*
apps/api/tests/...
circuits/revenue_proof/             Noir circuit (replaces financial_proof)
infra/prover/Dockerfile, infra/prover/credent-prove.sh
scripts/setup.ps1, scripts/dev.ps1, .env.example, README.md
apps/web/...                        rebuilt frontend
```

---

### Task 1: Circuit + prover image

**Files:** Create `circuits/revenue_proof/{Nargo.toml,src/main.nr}`, `infra/prover/Dockerfile`, `infra/prover/credent-prove.sh`. Delete `circuits/financial_proof`, `scripts/prove-financial-proof.ps1`, `scripts/generate-issuer-keys.mjs`.

- [ ] Circuit exactly as spec §5, plus the three Noir tests (meets, below → `should_fail`, commitment binds each day).
- [ ] Dockerfile: ubuntu:24.04, `noirup -v 1.0.0-beta.22`, `bbup -v 5.0.0-nightly.20260522`, `COPY circuits/revenue_proof /circuit`,
  `RUN nargo test && nargo compile && bb write_vk -b target/revenue_proof.json -o target/vk` (bakes VK and warms CRS).
- [ ] `credent-prove.sh <commit|prove|verify>` with `/work` mounted:
  - commit: copy the circuit to tmp, copy `/work/Prover.toml`, run `nargo execute`, write the hex after `Circuit output:` to `/work/commitment`.
  - prove: execute, then `bb prove … -k /circuit/target/vk/vk -o /work/out`, `bb verify`, and copy the vk to `/work/out/vk`.
  - verify: `bb verify -p /work/proof -i /work/public_inputs -k /work/vk`.
  - Non-zero exit on failure. If `nargo execute` fails, stderr contains `assert`.
- [ ] Run `docker build -f infra/prover/Dockerfile -t credent-prover .`. Expected: 3 Noir tests pass and the build succeeds.
- [ ] Commit `feat(zk): revenue_proof circuit and dockerised prover`.

### Task 2: Python project skeleton + amortization

**Files:** `apps/api/pyproject.toml`, `credent/__init__.py`, `credent/errors.py`, `credent/core/amortize.py`, `tests/core/test_amortize.py`.

**Produces:** `Installment(interest:int, principal:int)` with property `total`. `amortize(principal:int, apr_bps:int, epochs:int, epoch_days:int=7) -> list[Installment]`.

- [ ] Tests:
  - Sum of principals == principal for (1_000_000_00, 1800, 12), (12_345_67, 1800, 12), (100, 1800, 12).
  - All installments except the last have an equal `total`.
  - Interest strictly decreases.
  - apr 0 → interest all 0.
  - epochs ≤ 0 or principal ≤ 0 → `ValueError`.
- [ ] Implement with `Decimal`. Weekly rate `r = apr_bps/10000*epoch_days/365`. Payment is the level annuity, rounded half-up to cents. Each period's interest = round(balance·r). The last period's principal = the remaining balance.
- [ ] `uv run pytest tests/core/test_amortize.py` → PASS. Commit.

### Task 3: Sweep core

**Files:** `credent/core/sweep.py`, `tests/core/test_sweep.py`.

**Consumes:** `Installment`. **Produces:**
```python
class LoanStatus(StrEnum): ACTIVE, LATE, DEFAULTED, REPAID
@dataclass class LoanState: schedule: list[Installment]; epoch: int = 0; swept: int = 0;
    arrears_interest: int = 0; arrears_principal: int = 0; outstanding: int; consecutive_short: int = 0;
    status: LoanStatus = ACTIVE
  def due(self) -> int     # arrears + current installment total (0 if epoch >= len(schedule)) - swept, floored at 0
@dataclass class EpochResult: epoch: int; due: int; paid: int; shortfall: int; interest: int; principal: int; status: LoanStatus; event: str  # "InstallmentPaid"|"InstallmentShort"
def new_loan(principal, apr_bps, epochs) -> LoanState
def apply_payment(s: LoanState, amount: int) -> tuple[LoanState, int, int]   # (state, swept, released)
def close_epoch(s: LoanState) -> tuple[LoanState, EpochResult]
DEFAULT_AFTER = 3
```
- [ ] Tests:
  - Exact payment fills the installment, with 0 released.
  - Three partial payments fill it, and the overflow is released.
  - Short epoch → shortfall becomes arrears (interest-first split), status LATE, consecutive_short = 1.
  - The next epoch's due includes arrears, and one large payment clears arrears plus the current installment.
  - 3 consecutive shorts → DEFAULTED.
  - Payment on a DEFAULTED/REPAID loan → swept 0, released all (Review Focus 3).
  - Paying all 12 epochs → REPAID with outstanding 0.
  - The interest and principal reported across all EpochResults sum to the schedule totals.
  - Negative amount → `ValueError`.
- [ ] Implement allocation at close in the order arrears_interest → arrears_principal → cur_interest → cur_principal. Unpaid buckets become the new arrears. After the schedule ends, only arrears are due.
- [ ] PASS. Commit.

### Task 4: Pool + waterfall core

**Files:** `credent/core/pool.py`, `tests/core/test_pool.py`, `tests/core/test_pool_property.py`.

**Produces:**
```python
@dataclass class Tranche: name: str; nav: int = 0; shares: int = 0; coupon_arrears: int = 0; writedown: int = 0
@dataclass class Pool: cash: int = 0; outstanding: int = 0; treasury: int = 0;
    senior: Tranche; junior: Tranche   # defaults name "senior"/"junior"
  def tranche(self, name) -> Tranche
  def check(self) -> None   # asserts identity
@dataclass class Distribution: interest:int; principal:int; fee:int; senior:int; junior:int; senior_arrears:int
@dataclass class LossAllocation: loss:int; junior:int; senior:int
@dataclass class RecoveryAllocation: amount:int; senior:int; junior:int
SENIOR_COUPON_BPS=900; MAX_LEVERAGE=4; FEE_BPS=1000
def deposit(p, tranche_name, amount) -> tuple[Pool, int]          # shares minted
def draw(p, amount) -> Pool
def distribute(p, interest, principal, days) -> tuple[Pool, Distribution]
def default(p, outstanding_principal) -> tuple[Pool, LossAllocation]
def recover(p, amount) -> tuple[Pool, RecoveryAllocation]
def share_value(t: Tranche, shares: int) -> int
```
Errors in `credent/errors.py`: `SubordinationBreach`, `InsufficientLiquidity`, `TrancheImpaired`, `InvalidAmount` (all `DomainError` with `code`, `status=4xx`).
- [ ] Tests:
  - First deposit mints 1:1, and a later deposit mints at the current price.
  - Senior deposit exactly reaching 4× junior is OK, and 1 cent over raises `SubordinationBreach`.
  - Draw beyond cash raises.
  - Distribute: fee = 10%; the senior coupon is pro-rated by `outstanding/total_nav`; zero outstanding → senior due 0 (Review Focus 4); a coupon shortfall carries and is later caught up; junior gets the residual.
  - Loss < junior NAV, = junior NAV, and > junior NAV (senior impaired).
  - Loss with all capital deployed wipes both.
  - Recovery < senior writedown; recovery overflowing into junior restore plus gain.
  - Deposit into a tranche with shares > 0 and nav == 0 raises `TrancheImpaired`.
- [ ] Hypothesis property: random op sequences → `p.check()` holds, and no negative balances.
- [ ] PASS. Commit.

### Task 5: Crypto utils, sources, receipts, notary

**Files:** `credent/config.py`, `credent/crypto/{keys,canonical,merkle}.py`, `credent/sources/{profiles,receipts}.py`, `credent/notary.py`, tests for each.

**Produces:**
- `canonical_json(obj) -> str` (sorted keys, no spaces, ensure_ascii=False).
- `merkle_root(hashes: list[str]) -> str` (sha256 pairs, duplicate the last when odd; empty → 64 zeros).
- `KeyStore(dir).get(name) -> nacl.signing.SigningKey` (creates and persists 32-byte seed files). `sign_b64(key, bytes)`, `verify_b64(pubkey_b58, bytes, sig_b64) -> bool`.
- `PROFILES: dict[str, Profile]` for "saas", "ecommerce" and "distressed". `daily_revenue(profile, seed, start_day, days) -> list[int]` (deterministic). `split_payments(amount, rng) -> list[int]` (1–4 parts that sum exactly).
- `make_receipts(series, start_day, processor_key, tampered=False) -> list[dict]`, where each receipt = `{id, day, amount, currency:"USD", sig}`. `parse_receipts(rows, processor_pubkey, period_start, days) -> list[int]` raises `ReceiptInvalid(reason)` for a bad sig, duplicate id, or out-of-period day.
- `Attestation(id, source, period_start, period_end, account_hash, commitment, notary_pubkey, signature)`. `attest(source, period_start, period_end, account_ref, commitment, notary_key) -> Attestation`. `verify_attestation(a) -> bool`.
- [ ] Tests:
  - Determinism of `daily_revenue`, with ecommerce showing seasonality > saas variance and distressed collapsing after day 21 of the loan.
  - `split_payments` sums.
  - Receipts round-trip; tampered amount → ReceiptInvalid; duplicate → ReceiptInvalid.
  - Attestation verifies, and any field change breaks it.
  - Merkle root of 1, 2 and 3 leaves.
- [ ] PASS. Commit.

### Task 6: DB, models, ledger

**Files:** `credent/db.py`, `credent/models.py`, `credent/ledger.py`, `tests/test_ledger.py`.

**Produces:**
- Tables: `SimState(id=1, day)`, `Session(token, wallet)`, `Challenge(wallet, nonce)`, `Borrower(id, wallet, pseudonym, profile, seed)`, `PrivateSeries(borrower_id, source, daily_json, salt, total, period_start, period_end)`, `AttestationRow`, `ProofRow(id, borrower_id, attestation_id, threshold, commitment, proof_b64, public_inputs_b64, vk_b64, verified)`, `CreditLine(borrower_id, limit, proof_id, opened_day)`, `LoanRow(id, borrower_id, principal, apr_bps, epochs, installment, state_json, status, drawn_day)`, `PrivatePayment(id, borrower_id, loan_id, day, amount, swept, released)`, `PoolRow(id=1, state_json)`, `Position(wallet, tranche, shares)`, `Balance(wallet, amount)`, `LedgerEvent(seq, day, type, payload_json, prev_hash, hash, block)`, `Block(n, first_seq, last_seq, merkle_root, day, anchor_status, anchor_sig)`.
- `make_engine(url)`, `init_db(engine)`.
- `ledger.append(session, day, type, payload: dict) -> LedgerEvent` (no commit; the caller commits). `seal_block(session, day) -> Block | None` (None if there are no new events). `verify_chain(session) -> tuple[bool, int|None]`.
- [ ] Tests:
  - Hash chain links.
  - Seal assigns the block and merkle root, and an empty seal → None.
  - Mutating a payload in the DB → verify returns (False, seq) (Review Focus 5).
  - Altering a block's merkle root is detected.
- [ ] PASS. Commit.

### Task 7: Prover wrapper

**Files:** `credent/zk/{encode,prover}.py`, `tests/zk/test_encode.py`, `tests/zk/test_prover_docker.py` (marker `prover`), `tests/fakes.py` (FakeProver).

**Produces:**
```python
@dataclass class ProofArtifacts: proof_b64: str; public_inputs_b64: str; vk_b64: str; timings_ms: dict[str,int]
class Prover(Protocol):
  def commit(self, daily: list[int], salt: int) -> str        # 0x-hex
  def prove(self, daily, salt, threshold) -> ProofArtifacts    # raises ThresholdNotMet
  def verify(self, a: ProofArtifacts) -> bool
def prover_toml(daily, salt, threshold) -> str
def parse_public_inputs(b: bytes) -> tuple[int, str]          # (threshold, commitment 0x-hex lowercase 64)
def get_prover(settings) -> Prover                            # raises ProverUnavailable with setup text
```
`NoirProver(runner)` with `DockerRunner(image)` (`docker run --rm -v <tmp>:/work <image> credent-prove <mode>`) and `LocalRunner(circuit_dir)` (runs the same script with bash). `ProverUnavailable` is raised when docker is missing or the image doesn't exist (`docker image inspect`).
- [ ] Unit tests: TOML formatting (90 values, quoted strings); parse_public_inputs on a crafted 64-byte buffer; wrong length → ValueError.
- [ ] Docker test: commit → prove → verify True; the commitment from public inputs equals the commit output; threshold > total → ThresholdNotMet; flipping a public-input byte → verify False.
- [ ] `uv run pytest -m prover` PASS. Commit.

### Task 8: Services: auth, borrower onboarding

**Files:** `credent/services/{auth,borrower,pool_store}.py`, `credent/events.py`, `tests/services/test_borrower.py`.

**Produces:**
- `auth.challenge(s, wallet) -> str`, `auth.verify(s, wallet, sig_b58) -> token`, `auth.demo(s) -> (wallet, token)`, `auth.wallet_for(s, token) -> str|None`.
- `pool_store.load(s) -> Pool`, `pool_store.save(s, Pool)`.
- `borrower.connect_stripe(s, wallet, profile)`, `borrower.connect_receipts(s, wallet, rows)` → `PrivateSeriesView`.
- `borrower.attest(s, wallet, prover, keys)` → AttestationRow (+ ledger `AttestationRecorded`).
- `borrower.prove(s, wallet, threshold, prover)` → ProofRow (+ `ProofVerified`). Server-side check: `prover.verify`, public-input threshold == threshold, public-input commitment == attestation.commitment, and `verify_attestation`. Otherwise `ProofMismatch` / `ProofInvalid`.
- `borrower.open_credit_line(s, wallet)` (+ `CreditLineOpened`).
- `borrower.draw(s, wallet, amount)` (+ `LoanDrawn`; enforces limit, one active loan, and pool liquidity).
- `borrower.private_view(s, wallet)`.
- `events.Broadcaster.publish(dict)` and async `subscribe()`.
- [ ] Tests with FakeProver:
  - Full happy path, checking ledger event types in order.
  - Proof with a mismatched commitment → PROOF_MISMATCH (Review Focus 2).
  - Draw > limit → CREDIT_EXCEEDED; draw > pool cash → INSUFFICIENT_LIQUIDITY, with the state unchanged (Review Focus 1).
  - Threshold > total → THRESHOLD_NOT_MET.
  - Auth: valid signature → token; wrong signature → 401 error.
- [ ] PASS. Commit.

### Task 9: Services: lender, sim engine

**Files:** `credent/services/{lender,sim}.py`, `tests/services/test_sim.py`.

**Produces:**
- `lender.faucet(s, wallet, amount=100_000_00)`, `lender.deposit(s, wallet, tranche, amount)` (+ `Deposit`), `lender.positions(s, wallet)`.
- `sim.reset(s, prover, keys)` drops all rows and seeds 5 lenders (junior 400k, senior 1.4M), 3 borrowers (saas, ecommerce, distressed) onboarded through the *real* borrower service (so real proofs when the docker prover is used), with draws, then advances 28 days.
- `sim.advance(s, days)`: each day generates borrower payments → `apply_payment`, stores `PrivatePayment`. Every 7th day, for each loan: `close_epoch` → events, `distribute` → `InterestDistributed`, status changes → `LoanLate`/`LoanDefaulted` (+ `default()` → `LossAllocated`)/`LoanRepaid`, then `seal_block`.
- `sim.payment(s, borrower_id, amount)`, `sim.force_default(s, loan_id)`, `sim.recover(s, loan_id, amount)`.
- [ ] Tests (FakeProver):
  - After reset + advance(56), the saas loan is ACTIVE with 0 arrears, the distressed loan is DEFAULTED, and junior took the loss.
  - Identity holds after every day.
  - Ledger verify OK.
  - advance on an empty DB (no loans) works (Review Focus 4).
  - force_default + recover allocates senior-first.
- [ ] PASS. Commit.

### Task 10: Solana anchor

**Files:** `credent/anchor.py`, `tests/test_anchor.py`.

**Produces:** `SolanaAnchor(settings, keys)` with `.address`, `.ensure_funded()` (airdrop, no raise), `.anchor(block) -> (status, sig|None)` where status is `ANCHORED`, `UNANCHORED` or `DISABLED`. `AnchorWorker` drains unanchored blocks in a background thread every 10s.
- [ ] Tests: the memo bytes format; disabled → DISABLED; an RPC exception → UNANCHORED (mock the client).
- [ ] Manual: with ANCHOR_ENABLED=true, a sealed block gets a devnet signature (record the outcome; the devnet faucet may rate-limit).
- [ ] Commit.

### Task 11: HTTP API

**Files:** `credent/api/{app,deps,schemas,routes_auth,routes_borrower,routes_lender,routes_public,routes_sim}.py`, `credent/main.py`, `tests/api/test_api.py`, `tests/api/test_privacy.py`.

- [ ] Routes exactly as spec §8. A `DomainError` handler returns `{"code","message"}` with the error's status. Public responses are typed as `Public*` models. `/public/stream` is SSE via sse-starlette from the Broadcaster. CORS allows `http://localhost:3000`. The app factory `create_app(settings, prover=None)` lets tests inject FakeProver.
- [ ] Tests:
  - Each route's happy path through TestClient.
  - Error mapping (409 subordination, 400 credit exceeded, 503 prover unavailable).
  - The privacy crawl (§4): after reset+advance, GET every `/public/*` route and collect the SSE events published during a further advance. Assert none of the private payment amounts (all distinct values > 1000 cents), daily series values, or receipt ids appear as substrings in any body.
- [ ] PASS. Commit.

### Task 12: Setup and dev scripts, README

**Files:** `scripts/setup.ps1`, `scripts/setup.sh`, `scripts/dev.ps1`, `scripts/dev.sh`, `.env.example`, `README.md`, root `package.json` scripts, `.gitignore` (`apps/api/.venv`, `apps/api/data/`, `.env`).
- [ ] Setup installs uv if missing (`pip install uv`), runs `uv sync`, `corepack enable`, `pnpm install` in apps/web, and builds the docker image. Dev starts uvicorn :8000 and `pnpm dev` :3000.
- [ ] README rewritten around the pitch, privacy model, architecture, run steps, and demo script.
- [ ] Commit.

### Task 13: Frontend foundation

Use the frontend-design skill (aesthetic) and the dataviz skill (charts) before writing UI.

**Files:** delete `apps/web/app/api`, `lib/`, `types/`, `components/FinancialProof.tsx`, and the old page. Create `apps/web/lib/api.ts` (typed fetch client + `ApiError(code,message)`), `lib/types.ts` (hand-written to mirror `Public*` and private views), `lib/format.ts` (cents → $), `lib/session.tsx` (wallet sign-in via `signMessage`, demo fallback, token in localStorage), `lib/stream.ts` (`usePublicStream` SSE hook), `app/layout.tsx` (fonts, nav, wallet provider, demo dock), `globals.css` (design tokens).
- [ ] Read `node_modules/next/dist/docs` for anything App Router-specific before writing it (per apps/web/AGENTS.md).
- [ ] `pnpm tsc --noEmit` and `pnpm build` PASS. Commit.

### Task 14: Frontend pages

**Files:** `app/page.tsx`, `app/borrow/page.tsx` (+ components `SourceStep`, `NotarizeStep`, `ProveStep`, `DrawStep`, `Lockbox`), `app/lend/page.tsx` (`TrancheCard`, `DepositForm`, `Positions`), `app/explorer/page.tsx` (`LoanBook`, `TrancheChart`, `Waterfall`, `LedgerFeed`, `ProofVerifier`), `components/DemoDock.tsx`, `components/Redacted.tsx`.
- [ ] Every async action has loading, error and empty states. Private data uses `<Redacted>` unless the owner is viewing.
- [ ] `pnpm build` PASS. Commit.

### Task 15: End-to-end verification

- [ ] Run `scripts/dev.ps1`, then a browser walkthrough of all four flows (borrower via demo wallet with a real docker proof; lender deposit including a subordination error; +4 weeks to watch the sweeps; default plus waterfall in the explorer; proof re-verify; chain verify). Fix any issues found.
- [ ] Full `uv run pytest` (including `-m prover`) passes, along with `pnpm lint`.
- [ ] Final whole-branch code review via the code-reviewer agent. Address findings. Commit.
