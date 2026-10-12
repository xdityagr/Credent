export function AuthHeading({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-[44px] leading-[1] tracking-[-0.03em] text-[#f4f1ee]">{title}</h1>
      {description && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</p>}
    </div>
  );
}

/** A centered status panel for confirmation screens (inbox, verified, reset done). */
export function AuthStatus({
  icon,
  title,
  children,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  tone?: "neutral" | "good" | "loss" | "ember";
}) {
  const ring =
    tone === "good"
      ? "text-junior-text shadow-[0_0_40px_rgb(31_169_122/0.35)]"
      : tone === "loss"
        ? "text-loss-text shadow-[0_0_40px_rgb(232_71_61/0.3)]"
        : tone === "ember"
          ? "text-ember-1 shadow-[0_0_40px_rgb(255_138_61/0.3)]"
          : "text-ink shadow-[0_0_40px_rgb(255_255_255/0.08)]";
  return (
    <div>
      <span className={`glass mb-7 inline-flex size-14 items-center justify-center rounded-[18px] [&_svg]:size-6 ${ring}`}>{icon}</span>
      <h1 className="font-serif text-[40px] leading-[1.02] tracking-[-0.03em] text-[#f4f1ee]">{title}</h1>
      <div className="mt-4 space-y-5 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}
