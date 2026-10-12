import type { Metadata } from "next";
import { HowItWorks } from "@/components/site/landing/how-it-works";
import { Container, PageHero } from "@/components/site/page-hero";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

const ROLES = [
  {
    who: "Business",
    tone: "text-ember-1",
    does: [
      "Signs up, verifies email and creates a borrower company.",
      "Connects a revenue source: Stripe (test mode), signed receipts, or the demo business.",
      "Generates a revenue proof for a threshold it chooses.",
      "Applies to a pool, signs the terms with its wallet and receives cUSD.",
      "Repays automatically as customer payments pass through the lockbox; withdraws the remainder.",
    ],
  },
  {
    who: "Lender company",
    tone: "text-horizon-2",
    does: [
      "Creates a pool: target size, senior coupon, borrower APR, advance rate, term, minimum proven revenue.",
      "Funds the junior tranche first, then raises senior up to 4x junior.",
      "Reviews applications: the proof, the company profile and its Credent track record.",
      "Earns the coupon (senior) or the residual (junior) each week; withdraws from available cash.",
    ],
  },
  {
    who: "Anyone",
    tone: "text-ink",
    does: [
      "Reads every pool's capital stack, loan book and NAV history.",
      "Recomputes the ledger's hash chain and checks block anchors on Solana.",
      "Re-verifies any revenue proof, or downloads it to verify offline.",
      "Compares each pool's on-chain vault balance with its book.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        tone="ember"
        title={
          <>
            How Credent <span className="italic text-ink-2">works</span>
          </>
        }
        description="Credit sized to revenue a business can prove, priced by the lenders who take the risk, and recorded where anyone can audit it."
      />
      <HowItWorks heading={false} />
      <Container className="pb-24">
        <h2 className="font-serif text-[clamp(36px,4.6vw,60px)] leading-[1] tracking-[-0.02em] text-[#f4f1ee]">
          Who does <span className="italic text-ink-2">what</span>
        </h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.who} className="panel rounded-[24px] p-6 md:p-7">
              <h3 className={`text-[18px] font-medium ${r.tone}`}>{r.who}</h3>
              <ol className="mt-5 space-y-3.5">
                {r.does.map((d, i) => (
                  <li key={i} className="grid grid-cols-[22px_1fr] gap-2 text-[14.5px] leading-relaxed text-ink-2">
                    <span className="num text-ink-3">{i + 1}</span>
                    {d}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/signup" variant="white" magnetic>
            Create an account
          </ButtonLink>
          <ButtonLink href="/docs" variant="glass" magnetic>
            Read the docs
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
