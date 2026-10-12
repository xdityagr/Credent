"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "glass" | "white" | "ember" | "horizon" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  glass: "",
  white: "lg-btn--white",
  ember: "lg-btn--ember",
  horizon: "lg-btn--horizon",
  ghost: "lg-btn--ghost",
  danger: "lg-btn--danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-7 text-[15px]",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** SVG displacement refraction. Reserve for the single hero CTA. */
  refract?: boolean;
  /** Pulls the custom cursor toward the button on the marketing site. */
  magnetic?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;
type LinkProps = CommonProps & { href: string; external?: boolean } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof CommonProps | "href"
  >;

function classes({ variant = "glass", size = "md", refract, className }: CommonProps) {
  return cn("lg-btn select-none", variantClass[variant], sizeClass[size], refract && "lg-refract", className);
}

function Inner({ busy, icon, iconRight, children }: CommonProps) {
  return (
    <>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </>
  );
}

/**
 * LiquidGlassButton: pill, backdrop blur, gradient hairline border, specular top
 * highlight and an inner glow. Variants: glass, white, ember, horizon, ghost, danger.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, refract, magnetic, busy, icon, iconRight, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-magnetic={magnetic || undefined}
      className={classes({ variant, size, refract, className })}
      {...rest}
    >
      <Inner busy={busy} icon={icon} iconRight={iconRight}>
        {children}
      </Inner>
    </button>
  );
});

export function ButtonLink({
  href,
  external,
  variant,
  size,
  refract,
  magnetic,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkProps) {
  const cls = classes({ variant, size, refract, className });
  if (external || href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" data-magnetic={magnetic || undefined} className={cls} {...rest}>
        <Inner icon={icon} iconRight={iconRight}>
          {children}
        </Inner>
      </a>
    );
  }
  return (
    <Link href={href} data-magnetic={magnetic || undefined} className={cls} {...rest}>
      <Inner icon={icon} iconRight={iconRight}>
        {children}
      </Inner>
    </Link>
  );
}

export const LiquidGlassButton = Button;

/** Square glass icon button (topbar, toolbars). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }
>(function IconButton({ label, size = "md", className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-white/[0.03] text-ink-2 transition hover:border-line-strong hover:bg-white/[0.07] hover:text-ink active:scale-[0.97]",
        size === "md" ? "size-10" : "size-8",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/**
 * The SVG filter behind `refract`. Mounted once in the root layout. Chromium
 * applies it inside backdrop-filter; other engines fall back to plain blur.
 */
export function RefractionFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="lg-refraction" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
