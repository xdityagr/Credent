import { ButtonLink, ColumnLines, GlowText, HorizonArc } from "@/components/ui";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden pt-24 md:pt-32">
      <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,transparent,#000_30%,#000_60%,transparent)]" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center px-5 text-center md:px-8">
        <h2 className="max-w-[14ch] font-serif text-[clamp(48px,7.4vw,108px)] leading-[0.94] tracking-[-0.035em] text-[#f4f1ee]">
          Borrow on what you <GlowText tone="ember"><span className="italic">earn</span></GlowText>, not what you show.
        </h2>
        <p className="mt-7 max-w-[44ch] text-[17px] leading-relaxed text-ink-2">
          Open an account, pick your side, and try it end to end with a demo business or your own Stripe test account.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/signup" variant="ember" size="lg" magnetic>
            Get started
          </ButtonLink>
          <ButtonLink href="/login?demo=1" variant="glass" size="lg" magnetic>
            Try the demo
          </ButtonLink>
        </div>
      </div>
      <HorizonArc tone="ember" className="mt-6 h-[260px] md:h-[320px]" intensity={0.9} />
    </section>
  );
}
