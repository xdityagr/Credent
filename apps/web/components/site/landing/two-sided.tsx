import { Banknote, BookOpenCheck, Building2, Coins, Gauge, Layers, ShieldCheck, Wallet } from "lucide-react";
import { ButtonLink, IconChip, SpotlightCard } from "@/components/ui";
import { cn } from "@/lib/cn";

function Card({
  icon,
  title,
  body,
  tone,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "ember" | "horizon";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <SpotlightCard tone={tone} className={cn("flex flex-col p-6 md:p-7", className)}>
      <div className="flex items-start gap-4">
        <IconChip tone={tone}>{icon}</IconChip>
        <div>
          <h3 className="text-[17px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{body}</p>
        </div>
      </div>
      {children}
    </SpotlightCard>
  );
}

function Orbit() {
  // Neonverse-style radial of glass chips around a lit core
  const items = [Banknote, Coins, Wallet, Gauge, Layers];
  return (
    <div className="relative mx-auto mt-10 aspect-[2.2/1] w-full max-w-[420px]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line" />
      <div className="absolute left-1/2 top-1/2 size-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line" />
      <div className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[radial-gradient(circle_at_50%_30%,#fff,#9ab6ff_40%,#2d5bff)] shadow-[0_0_40px_rgb(45_91_255/0.6)]">
        <Layers className="size-5 text-black/80" />
      </div>
      {items.map((I, i) => {
        const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <span
            key={i}
            className="glass absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-ink-2"
            style={{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 40}%` }}
          >
            <I className="size-4" />
          </span>
        );
      })}
    </div>
  );
}

function MiniStack() {
  return (
    <div className="mt-8 flex items-end gap-4" aria-hidden>
      <div className="flex h-28 w-16 flex-col gap-[2px] overflow-hidden rounded-[8px]">
        <span className="flex-[3] bg-senior" />
        <span className="flex-1 bg-junior" />
      </div>
      <div className="space-y-2 pb-1 text-[12.5px]">
        <div className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-[2px] bg-senior" /> Senior, fixed coupon, paid first
        </div>
        <div className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-[2px] bg-junior" /> Junior, residual yield, first loss
        </div>
        <div className="text-ink-3">Senior can be at most 4x junior</div>
      </div>
    </div>
  );
}

export function TwoSided() {
  return (
    <section className="relative mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-28">
      <h2 className="max-w-[16ch] font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
        Two sides, <span className="italic text-ink-2">one book</span>
      </h2>

      <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-6">
        {/* businesses */}
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-[22px] font-medium tracking-[-0.015em] text-ink">For businesses</h3>
              <p className="mt-1 text-[14.5px] text-ink-2">Working capital sized to revenue you can prove.</p>
            </div>
            <ButtonLink href="/signup" size="sm" variant="ember">
              Apply for credit
            </ButtonLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              tone="ember"
              className="sm:col-span-2"
              icon={<ShieldCheck />}
              title="Prove, don't disclose"
              body="Lenders learn that 90-day revenue clears a threshold. They never see daily sales, customers or bank details."
            >
              <div className="mt-7 flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-black/40 p-4 text-[13px]">
                <span className="text-ink-3">Shared</span>
                <span className="num text-ink">revenue ≥ $240,000</span>
                <span className="mx-1 h-4 w-px bg-line-strong" />
                <span className="text-ink-3">Kept</span>
                <span className="dither inline-block h-3 w-24 rounded-[3px]" />
                <span className="dither inline-block h-3 w-14 rounded-[3px]" />
              </div>
            </Card>
            <Card tone="ember" icon={<Building2 />} title="Repay from sales" body="A lockbox takes the weekly installment from incoming payments and releases the rest to you." />
            <Card tone="ember" icon={<Wallet />} title="No SOL needed" body="Credent pays every network fee. Link Phantom or Solflare, or use a custodial wallet." />
          </div>
        </div>

        {/* lenders */}
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-[22px] font-medium tracking-[-0.015em] text-ink">For lenders</h3>
              <p className="mt-1 text-[14.5px] text-ink-2">Run a pool with your terms, on a book anyone can audit.</p>
            </div>
            <ButtonLink href="/signup" size="sm" variant="horizon">
              Start a pool
            </ButtonLink>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card tone="horizon" icon={<Layers />} title="Your pool, your terms" body="Set target size, coupon, APR, advance rate, term and the minimum proven revenue. Approve each application yourself.">
              <Orbit />
            </Card>
            <Card tone="horizon" icon={<Coins />} title="Choose your risk" body="Fund the senior tranche for a fixed coupon, or junior for the residual.">
              <MiniStack />
            </Card>
            <Card
              tone="horizon"
              className="sm:col-span-2"
              icon={<BookOpenCheck />}
              title="Reserves you can check"
              body="Pool vaults hold real cUSD on Solana devnet. The public pool page compares the on-chain balance with the book and says whether they match."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
