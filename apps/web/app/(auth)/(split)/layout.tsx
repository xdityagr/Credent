import Link from "next/link";
import { Blob, ColumnLines, CreditNote3D, Wordmark } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex min-h-dvh flex-col px-5 py-6 sm:px-10 md:px-14">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Credent home" className="rounded-lg">
            <Wordmark />
          </Link>
          <Link href="/" className="text-[13.5px] text-ink-2 transition hover:text-ink">
            Back to site
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <footer className="text-[12px] text-ink-3">Solana devnet with test cUSD. No real money moves.</footer>
      </div>

      {/* visual side */}
      <aside aria-hidden className="relative m-3 hidden overflow-hidden rounded-[32px] border border-line bg-[#050505] lg:block">
        <ColumnLines cols={3} />
        <Blob tone="ember" className="-left-24 top-[12%] size-[520px] opacity-80" />
        <Blob tone="teal" className="right-[-10%] top-[-8%] size-[460px] opacity-90" />
        <Blob tone="horizon" className="bottom-[-18%] right-[-6%] size-[520px] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,transparent,rgb(0_0_0/0.65))]" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <p className="max-w-[16ch] font-serif text-[clamp(40px,3.8vw,60px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
            Private credit, <span className="italic">public book.</span>
          </p>
          <div className="mx-auto w-[min(78%,460px)]">
            <CreditNote3D tone="ember" rotate={-8} />
          </div>
          <p className="max-w-[44ch] text-[14px] leading-relaxed text-white/60">
            Prove revenue without revealing it. Borrow from pools run by lenders who publish their terms. Repay from sales,
            automatically.
          </p>
        </div>
      </aside>
    </div>
  );
}
