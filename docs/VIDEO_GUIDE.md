# Credent: cheatsheet + 3-minute video script

## Cheatsheet

### The pitch
Businesses prove their revenue with a **zero-knowledge proof**, so lenders get a guarantee without seeing the numbers. Loans are repaid automatically from incoming customer payments (a **lockbox**). The loan book is **public on Solana**. **Private credit, public book**: Goldfinch with the transparency inverted.

### Keywords
| Word | Plain English |
|---|---|
| **Pool** | A pot of lender money with its own rules (rate, loan size, term). Borrowers apply to pools. |
| **Pool manager** | The lender company that runs a pool and approves borrowers. |
| **Tranche** | A "slice" of a pool's money. Every pool has two. |
| **Junior** (first-loss) | The manager's own slice. **Loses first** if a borrower defaults; keeps the leftover interest (higher return). Gives the manager skin in the game. |
| **Senior** | Outside lenders' slice. Fixed rate (e.g. 9%), paid first, loses only after junior is wiped out (lower risk). |
| **Max leverage 4×** | Senior can be at most 4× junior, so there's always a cushion. |
| **Waterfall** | The order money flows. Interest: 10% fee → senior's fixed rate → junior gets the rest. Losses: junior first, then senior. |
| **NAV / shares** | What a slice is worth now; depositors hold shares that grow with interest. |
| **Threshold** | What the borrower proves: "90-day revenue ≥ $240k". Lenders see only this. |
| **Advance rate** | Loan size per $ of proven revenue (25% of $240k = $60k). |
| **Epoch / installment** | Loans repay weekly; each week has a fixed installment (e.g. 12 weeks). |
| **Lockbox / sweep** | Customer payments land here first; this week's installment is taken, the rest released to the business. |
| **Default** | 3 short weeks in a row → the unpaid amount is written off through the loss waterfall. |
| **ZK proof** | Maths that proves a statement about data without revealing the data. |
| **Commitment / notary** | A sealed fingerprint of the revenue data; the notary signs that it came from the real source (zkTLS in production). |
| **Pseudonym** | `BRW-…` / `LND-…`, the only names on the public ledger. |
| **Hash chain / anchoring** | Each ledger entry fingerprints the previous one, and the blocks are stamped on Solana, so history can't be rewritten. |
| **cUSD / vault** | Test dollar token on Solana / each pool's on-chain account. |

### One loan, in numbers
1. Meridian's pool: $200k junior + $800k senior = $1M.
2. Northwind proves revenue ≥ $240k and borrows $60k (25%) over 12 weeks: about $5,100 a week.
3. A customer pays $8,000: ~$5,100 is swept, ~$2,900 goes to Northwind.
4. If 3 weeks in a row come up short, the loan defaults and junior absorbs the loss; senior is untouched.

**Public:** pool, loan, installments, losses. **Private:** Northwind's name, revenue, customers.

### Features
- ZK revenue proofs.
- Stripe, signed-receipt and demo revenue sources.
- Lockbox sweep.
- Lender-run pools with junior/senior tranches.
- Auto-approve rules.
- Wallet-signed deposits and loans (Credent pays the fees).
- Real Solana token flows.
- Public explorer with one-click verification.
- Proof of reserves.
- Accounts and onboarding.
- Branded emails and notifications.
- Accelerated demo clock.

### Tech stack
| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind 4, Motion | Fast, precise design, smooth animation |
| Backend | Python, FastAPI, Postgres, SQLModel | Clear finance logic, reliable books; integer cents, so no rounding errors |
| ZK | Noir + Barretenberg (UltraHonk) | Circuit sums 90 days, checks ≥ threshold, outputs a commitment |
| Chain | Solana, SPL tokens, LiteSVM | Fees under a cent, fast; real Solana runtime locally or on devnet |
| Auth / email | argon2, cookie sessions, SMTP | Standard security; works with any mail provider |
| Quality | 132 tests incl. a privacy crawl | Fails if any public page leaks private numbers |

**Privacy trick:** all borrowers' inflows go on-chain as **one daily total**, so no single business's revenue is visible.

### Real vs simulated
- **Real:** ZK proofs, Solana transfers, the ledger and anchoring, auth, email, the Stripe connector.
- **Simulated:** the notary (zkTLS in production), cUSD (USDC in production), the demo and Stripe sandbox revenue, the fast clock.

---

## 3-minute script

**Setup:**
- Logged out.
- Tabs: `/`, `/pools`, `/explorer`, `/login`.
- Clock running for 10 minutes beforehand.
- In a second browser profile, the lender logged in with an application already waiting for review.
- Face cam on for the story part, if you can. Judges back people, and seeing you helps.

> Quotes = what you **say**. *[Brackets]* = what you **do**. **🟧 Orange blanks are yours to fill with true details**; examples are in part 3 below the script.

**0:00 · The story** *[Face cam, or the landing hero]*
"Hi, I'm Aditya. **🟧 [Your moment: one concrete scene. Who needed money, what happened.]**

What struck me was the trade they were forced into. To borrow against their own revenue, they had to hand over **everything**: every customer, every payment, every bad week, to every lender who looked at them. And most still said no.

At the same time, I was watching on-chain credit. Goldfinch, Maple and others promised transparency, but borrowers were the ones exposed, while the loan book was hard to inspect. I realised it was **backwards**. The business's data should be private, and the lender's book should be public."

**0:35 · Why us** *[Still face cam]*
"**🟧 [Why you: one or two lines of real background.]** That's why I'm building this: I've sat on **🟧 [the borrower's / the lender's / the engineer's]** side of this problem, and I know the cryptography to fix it."

**0:50 · What it is** *[Landing hero; move the cursor over the card]*
"So we built **Credent**. A business **proves** its revenue with a zero-knowledge proof, so the lender gets a guarantee without seeing a single number. The loan repays itself from incoming sales. And the whole loan book lives **on Solana** for anyone to audit. Private credit, public book."

**1:10 · Public side** *[/pools → open a pool, point at the capital stack]*
"Lenders run their own pools with two slices. **Junior** is the manager's own money and takes losses first; **senior** is outside lenders on a fixed rate, protected by junior. Skin in the game.
*[/explorer → **Verify the entire chain**]* Every loan and repayment is public and tamper-proof. No company names, no revenue: only pseudonyms."

**1:35 · Borrower** *[Login → Try the demo → As a business → Revenue → Connect → Stripe → Sandbox account → Create]*
"As a business, I connect Stripe. *[Scroll to Recent payments]* 90 days of invoices, visible only to me.
*[Proofs → Prove]* I prove one thing: revenue of at least $240,000, as a real zero-knowledge proof. *[Pools → Apply]* And I apply."

**2:05 · Lender** *[Switch to the lender profile → Review queue → open the application]*
"The lender sees a pseudonym, a valid proof and a track record. Nothing else. Approve."

**2:15 · Money moves** *[Borrower → Applications → **Sign and draw** / **Accept and receive funds**; point at the balance]*
"I sign with my wallet, and the funds land on Solana instantly. *[Loans → open the loan]* Every customer payment now passes a lockbox: the week's installment first, the rest to me. If it goes bad, junior takes the loss before any senior lender."

**2:40 · Close** *[/explorer, then back to face cam]*
"Real zero-knowledge proofs, real token flows on Solana, a Python and Next.js stack, and a public book anyone can check.
**🟧 [Traction or next step: one line.]**
Small businesses shouldn't have to give up their privacy to get credit. Credent: **private credit, public book.**"

### The 🟧 blanks: how to fill them (keep each one true)

| Blank | What makes it strong | Example shapes (adapt; don't use one that isn't true) |
|---|---|---|
| **Your moment** | One specific person and one specific event, in 1–2 sentences | "My [parent / friend / first employer] ran a [business]. When they needed working capital, the lender asked for two years of statements, then said no." · "While building [X], I saw companies we worked with turned down despite steady Stripe revenue." |
| **Why you** | Real experience that touches **credit, small businesses, or ZK/crypto engineering**; ideally two of them | "I've [built on Solana / worked with ZK circuits] for [N] years, and [saw this at a fintech / grew up around a family business]." · "I built every layer of this myself: the circuits, the Solana flows, the lending engine." |
| **Whose side** | The side of the problem you've personally lived | borrower · lender · engineer |
| **Traction / next** | Anything real: users you spoke to, a pilot, a waitlist, or the concrete next milestone | "We've spoken to [N] founders, and [N] want in." · "Next: real zkTLS with Stripe, then a pilot with [type of] lenders." |

**Founder–product fit, in one sentence for yourself:** *you have personally seen the problem (the story), you have the rare mix of skills it needs (finance plus ZK plus Solana), and the product exists and works (the demo).* Every 🟧 blank should support one of those three.

**Rules:** keep the story under 40 seconds. Be specific (a name, a business type, a number). Never claim traction you don't have. "Here's what's next" beats an inflated number.

---

## If a judge asks

| Question | Answer |
|---|---|
| **Is the revenue real?** | The proof is bound to a commitment a notary signs after seeing the source. In production that's zkTLS; here the notary is simulated. The proofs themselves are real. |
| **What if they divert payments?** | The lockbox is the processor's payout account, a loan condition. Missed weeks lead to default, which goes on their public track record. |
| **Why Solana?** | Fees under a cent and fast settlement for weekly transfers; we pay the fees, so users need no SOL. |
| **Can chain data reveal revenue?** | No. Inflows go on-chain as one combined daily total, and a test crawls every public page for leaks. |
| **vs Goldfinch / Maple / Clearco?** | They expose borrowers or see all their data. We give lenders a cryptographic guarantee without the data, plus a fully public book. |
| **Business model?** | A 10% protocol fee on the interest borrowers pay. |
| **What's next?** | Real zkTLS, USDC on mainnet, an on-chain program for the waterfall, KYB. |
