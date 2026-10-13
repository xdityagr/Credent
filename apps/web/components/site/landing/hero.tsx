"use client";

import { motion, useReducedMotion } from "motion/react";
import { ButtonLink, ColumnLines, CreditNote3D, GlowText } from "@/components/ui";
import { useChainConfig } from "@/lib/queries";
import { TechRow } from "../tech-row";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const cluster = useChainConfig().data?.cluster;
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 1, ease, delay },
        };

  return (
    <section className="relative isolate overflow-hidden pt-[76px]">
      <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000_60%,transparent)]" />
      {/* warm haze behind the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] -z-10 h-[520px] w-[900px] -translate-x-1/2 opacity-70 blur-3xl"
        style={{ background: "radial-gradient(40% 50% at 50% 50%, rgb(226 69 43 / 0.16), rgb(15 59 58 / 0.12) 60%, transparent)" }}
      />

      {/* tilted credit notes (Lume): cropped by the viewport edges on desktop */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-[-6%] top-[300px] hidden w-[min(32vw,440px)] lg:block xl:left-[-1%]"
        initial={reduce ? false : { opacity: 0, x: -60, rotate: -30 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 1.4, ease, delay: 0.35 }}
      >
        <CreditNote3D tone="ember" rotate={-16} />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-8%] top-[150px] hidden w-[min(30vw,410px)] lg:block xl:right-[-4%]"
        initial={reduce ? false : { opacity: 0, x: 60, rotate: 30 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 1.4, ease, delay: 0.5 }}
      >
        <CreditNote3D tone="horizon" rotate={21} />
      </motion.div>

      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center px-5 pb-20 pt-20 text-center md:px-8 md:pt-28">
        <motion.a
          {...rise(0)}
          href="/explorer"
          className="glass inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] text-ink-2 transition hover:text-white"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-pulse-dot rounded-full bg-junior-text" />
          </span>
          {cluster === "local" ? "Running on the Solana runtime" : `Live on Solana ${cluster ?? "devnet"}`}
        </motion.a>

        <motion.h1
          {...rise(0.08)}
          className="mt-8 max-w-[13ch] font-serif text-[clamp(52px,8.6vw,124px)] font-normal leading-[0.92] tracking-[-0.035em] text-[#f4f1ee]"
        >
          Private credit,{" "}
          <span className="italic">
            public <GlowText tone="ember">book.</GlowText>
          </span>
        </motion.h1>

        <motion.p {...rise(0.18)} className="mt-8 max-w-[46ch] text-[17px] leading-relaxed text-ink-2 md:text-[18px]">
          Businesses borrow against revenue they prove but never reveal. Lenders run the pools. Every loan, tranche and loss
          sits on a ledger anyone can check.
        </motion.p>

        <motion.div {...rise(0.28)} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/signup" variant="white" size="lg" magnetic className="shadow-[0_0_60px_-10px_rgb(255_255_255/0.5)]">
            Get started
          </ButtonLink>
          <ButtonLink href="/pools" variant="glass" size="lg" refract magnetic>
            Explore pools
          </ButtonLink>
        </motion.div>

        {/* mobile / tablet: one note under the CTAs */}
        <div className="mt-16 w-[min(86vw,380px)] lg:hidden" aria-hidden>
          <CreditNote3D tone="ember" rotate={-6} />
        </div>

        <motion.div {...rise(0.45)} className="mt-20 w-full lg:mt-36">
          <TechRow />
        </motion.div>
      </div>
    </section>
  );
}
