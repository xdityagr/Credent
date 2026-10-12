import { FAQ } from "@/components/site/faq";
import { FinalCta } from "@/components/site/landing/final-cta";
import { Hero } from "@/components/site/landing/hero";
import { HowItWorks } from "@/components/site/landing/how-it-works";
import { LiveStats } from "@/components/site/landing/live-stats";
import { PoolsPreview } from "@/components/site/landing/pools-preview";
import { PrivacySplit } from "@/components/site/landing/privacy-split";
import { TwoSided } from "@/components/site/landing/two-sided";
import { VerifySection } from "@/components/site/landing/verify";
import { Accordion } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Hero />
      <LiveStats />
      <HowItWorks />
      <TwoSided />
      <PrivacySplit />
      <PoolsPreview />
      <VerifySection />
      <section className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_1.6fr]">
        <h2 className="max-w-[12ch] font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
          Questions, <span className="italic text-ink-2">answered</span>
        </h2>
        <Accordion items={FAQ} />
      </section>
      <FinalCta />
    </>
  );
}
