/* eslint-disable @next/next/no-img-element -- logos come from the API host at runtime */
import { cn } from "@/lib/cn";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Organisation avatar: the uploaded logo, else initials on the side's gradient. */
export function OrgAvatar({
  name,
  src,
  kind,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  kind?: "BORROWER" | "LENDER" | null;
  size?: number;
  className?: string;
}) {
  const bg =
    kind === "LENDER"
      ? "linear-gradient(135deg,#2d5bff,#8fb4ff)"
      : kind === "BORROWER"
        ? "linear-gradient(135deg,#ff8a3d,#e2452b 60%,#3a0f0a)"
        : "linear-gradient(135deg,#2a2a2e,#151517)";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] border border-line-strong", className)}
      style={{ width: size, height: size, background: src ? "#111" : bg }}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-medium text-white" style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
