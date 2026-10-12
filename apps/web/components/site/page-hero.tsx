import { ColumnLines } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Header band for site sub-pages: serif title over hairline columns and a soft glow. */
export function PageHero({
  title,
  description,
  children,
  tone = "horizon",
  className,
  align = "left",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "ember" | "horizon";
  className?: string;
  align?: "left" | "center";
}) {
  const glow =
    tone === "ember"
      ? "radial-gradient(45% 60% at 30% 0%, rgb(226 69 43 / 0.16), rgb(15 59 58 / 0.1) 50%, transparent 80%)"
      : "radial-gradient(45% 60% at 30% 0%, rgb(45 91 255 / 0.18), rgb(127 227 255 / 0.05) 50%, transparent 80%)";
  return (
    <section className={cn("relative isolate overflow-hidden pt-[76px]", className)}>
      <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: glow }} />
      <div
        className={cn(
          "relative mx-auto max-w-[1280px] px-5 pb-12 pt-16 md:px-8 md:pb-16 md:pt-24",
          align === "center" && "flex flex-col items-center text-center",
        )}
      >
        <h1 className="max-w-[18ch] font-serif text-[clamp(44px,6.4vw,88px)] leading-[0.96] tracking-[-0.03em] text-[#f4f1ee]">{title}</h1>
        {description && <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">{description}</p>}
        {children}
      </div>
    </section>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1280px] px-5 md:px-8", className)}>{children}</div>;
}
