import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { FAQ } from "@/components/site/faq";
import { Container, PageHero } from "@/components/site/page-hero";
import { Accordion, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Docs" };

const TOC = [
  { id: "privacy", label: "Privacy model" },
  { id: "glossary", label: "Glossary" },
  { id: "wallets", label: "Devnet wallet setup" },
  { id: "faq", label: "FAQ" },
];

type Who = "yes" | "no" | string;
const PRIVACY: { item: string; pub: Who; manager: Who; business: Who }[] = [
  { item: "Company name, website, description", pub: "no", manager: "yes", business: "yes" },
  { item: "Pseudonym (e.g. BRW-7F3A)", pub: "yes", manager: "yes", business: "yes" },
  { item: "Revenue claim (90-day revenue ≥ threshold)", pub: "yes", manager: "yes", business: "yes" },
  { item: "Exact revenue, daily figures", pub: "no", manager: "no", business: "yes" },
  { item: "Customers, payment details, bank account", pub: "no", manager: "no", business: "yes" },
  { item: "Loan principal, APR, schedule, status", pub: "yes", manager: "yes", business: "yes" },
  { item: "Each week's installment paid or short", pub: "yes", manager: "yes", business: "yes" },
  { item: "Individual customer payments into the lockbox", pub: "no", manager: "no", business: "yes" },
  { item: "Amount released to the business each week", pub: "no", manager: "no", business: "yes" },
  { item: "Applications that were declined or withdrawn", pub: "no", manager: "Their pool only", business: "yes" },
  { item: "Tranche balances, share prices, losses", pub: "yes", manager: "yes", business: "yes" },
  { item: "Pool vault balance on Solana", pub: "yes", manager: "yes", business: "yes" },
];

const GLOSSARY: [string, string][] = [
  ["Pool", "A lending fund run by one lender company, with its own published terms and two tranches."],
  ["Senior tranche", "Capital that earns a fixed coupon and is paid before junior. Loses money only after junior is wiped out."],
  ["Junior tranche", "First-loss capital. Earns whatever interest remains after the fee and the senior coupon."],
  ["Leverage", "Senior capital divided by junior. Credent caps it at 4x, so junior is always at least 20% of a pool."],
  ["Advance rate", "The share of proven 90-day revenue a pool will lend. A 25% advance on ≥ $240,000 allows up to $60,000."],
  ["Revenue proof", "A Noir zero-knowledge proof that a notarized revenue series sums to at least a threshold."],
  ["Notary", "The service that signs a commitment to revenue data it observed (a Stripe session over zkTLS, or signed receipts)."],
  ["Lockbox", "The account customer payments pass through. It pays the weekly installment first and releases the rest."],
  ["Epoch", "One week. Installments are due, and pools settle, once per epoch."],
  ["Waterfall", "The fixed order money moves in: fee, senior coupon, junior residual. Losses run the other way: junior first."],
  ["NAV", "Net asset value: what a tranche is worth after interest earned and losses taken."],
  ["cUSD", "Credent's test dollar, an SPL token on Solana devnet with 6 decimals. It has no real-world value."],
  ["Anchor", "A Solana memo transaction holding a block's Merkle root, so the ledger can't be rewritten unnoticed."],
  ["Reserves check", "A comparison of a pool vault's on-chain cUSD balance with the cash the book says it holds."],
];

function Cell({ v }: { v: Who }) {
  if (v === "yes")
    return (
      <span className="inline-flex items-center gap-1.5 text-junior-text">
        <Check className="size-4" aria-hidden /> Sees it
      </span>
    );
  if (v === "no")
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        <Minus className="size-4" aria-hidden /> Never
      </span>
    );
  return <span className="text-warn">{v}</span>;
}

function Section({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-12">
      <h2 className="font-serif text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.02em] text-[#f4f1ee]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <>
      <PageHero
        title={
          <>
            The <span className="italic text-ink-2">docs</span>
          </>
        }
        description="Everything on one page: who can see what, the vocabulary, how to set up a devnet wallet, and answers to common questions."
      />
      <Container className="grid gap-12 pb-28 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 border-l border-line">
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[14px] text-ink-2 transition hover:border-white/60 hover:text-white">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-16">
          <Section id="privacy" title={<>Privacy <span className="italic text-ink-2">model</span></>}>
            <p className="max-w-[64ch] text-[15.5px] leading-relaxed text-ink-2">
              Credent publishes everything a lender needs to price risk and nothing a business would mind a competitor
              seeing. The public ledger never contains a company name, a revenue figure or a customer payment.
            </p>
            <div className="mt-8 overflow-x-auto rounded-[20px] border border-line" data-lenis-prevent>
              <table className="w-full min-w-[680px] text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
                    <th className="px-5 py-3 font-normal">Information</th>
                    <th className="px-5 py-3 font-normal">The public</th>
                    <th className="px-5 py-3 font-normal">Pool manager</th>
                    <th className="px-5 py-3 font-normal">The business</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIVACY.map((r) => (
                    <tr key={r.item} className="border-t border-line/60">
                      <td className="px-5 py-3 text-ink">{r.item}</td>
                      <td className="px-5 py-3"><Cell v={r.pub} /></td>
                      <td className="px-5 py-3"><Cell v={r.manager} /></td>
                      <td className="px-5 py-3"><Cell v={r.business} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 max-w-[64ch] text-[14px] leading-relaxed text-ink-3">
              Why customer payments aren&apos;t on-chain: per-borrower token accounts would publish each business&apos;s
              revenue and defeat the proof. Instead, inflows are recorded privately and minted to one shared collections
              account once a day, across every borrower. Only installments, which are already public, move to pool vaults.
            </p>
          </Section>

          <Section id="glossary" title="Glossary">
            <dl className="grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-2">
              {GLOSSARY.map(([t, d]) => (
                <div key={t} className="bg-[#0a0a0b] p-5">
                  <dt className="text-[15px] font-medium text-ink">{t}</dt>
                  <dd className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{d}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="wallets" title={<>Devnet wallet <span className="italic text-ink-2">setup</span></>}>
            <ol className="max-w-[68ch] space-y-6">
              {[
                ["Pick a wallet", "Install Phantom or Solflare in your browser. If you'd rather not, skip ahead: Credent can create a custodial wallet for your company during onboarding."],
                ["Switch to devnet", "Phantom: Settings → Developer Settings → Testnet Mode, then choose Solana Devnet. Solflare: Settings → Network → Devnet."],
                ["Link it to Credent", "During onboarding (or in Settings → Wallets), choose your wallet and approve the sign-in message. Signing proves you own the address; it doesn't move funds or cost anything."],
                ["Get test cUSD", "From Funds in the app, use the faucet to mint test cUSD to your wallet. You don't need SOL: Credent's fee payer covers every transaction."],
                ["Check it on Explorer", "Every transfer links to Solana Explorer with ?cluster=devnet so you can confirm it landed."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[36px_1fr] gap-3">
                  <span className="num inline-flex size-7 items-center justify-center rounded-full border border-line-strong text-[13px] text-ink">{i + 1}</span>
                  <div>
                    <h3 className="text-[16px] font-medium text-ink">{t}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="https://phantom.app/download" variant="glass" size="sm">
                Get Phantom
              </ButtonLink>
              <ButtonLink href="https://solflare.com/download" variant="glass" size="sm">
                Get Solflare
              </ButtonLink>
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <Accordion items={FAQ} />
          </Section>
        </div>
      </Container>
    </>
  );
}
