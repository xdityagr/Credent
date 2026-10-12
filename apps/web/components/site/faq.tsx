import Link from "next/link";

export const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What exactly do lenders learn about my business?",
    a: "That your revenue over the last 90 days was at least the threshold you chose, plus the profile you share with the pool you apply to. They do not see daily figures, customers, or bank details. The public ledger shows only a pseudonym such as BRW-7F3A.",
  },
  {
    q: "How can a proof say anything about my revenue if nobody sees it?",
    a: "A notary signs a commitment to your revenue series (from a Stripe session via zkTLS, or from signed payment receipts). A Noir circuit then proves that the committed numbers sum to at least your threshold. Anyone can verify the proof against the notary's signature without the numbers themselves.",
  },
  {
    q: "How do repayments work?",
    a: "Customer payments route through a lockbox. Each week the installment is taken first and everything above it is released to your operating balance, which you can withdraw. If a week comes in short, the shortfall carries forward; repeated shortfalls make the loan late, then defaulted.",
  },
  {
    q: "What is the difference between senior and junior?",
    a: "Senior earns a fixed coupon and is paid first. Junior earns whatever interest is left over and absorbs losses first. A pool can hold at most four dollars of senior for every dollar of junior.",
  },
  {
    q: "Do I need SOL or a crypto wallet?",
    a: (
      <>
        No SOL. Credent pays network fees for every transaction. You can link Phantom or Solflare, or create a custodial
        Credent wallet in one click. See <Link className="text-ink underline underline-offset-4" href="/docs#wallets">devnet wallet setup</Link>.
      </>
    ),
  },
  {
    q: "Is this real money?",
    a: "Not yet. Credent runs on Solana devnet with cUSD, a test token. The transfers, signatures and ledger anchors are real devnet transactions you can inspect on Solana Explorer.",
  },
];
