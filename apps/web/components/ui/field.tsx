"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[14px] border border-line-strong bg-white/[0.03] px-4 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-[border-color,box-shadow,background] hover:border-white/20 focus:border-horizon-2/70 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgb(45_91_255/0.18)] aria-[invalid=true]:border-loss/70 aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgb(232_71_61/0.18)] disabled:opacity-50";

/**
 * Field: label + control + hint/error, wired for a11y. The single child control
 * receives id, aria-invalid and aria-describedby.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
  labelAction,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactElement<Record<string, unknown>>;
  className?: string;
  optional?: boolean;
  labelAction?: React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hint || error ? descId : undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] text-ink-2">
          {label}
          {optional && <span className="ml-1.5 text-ink-3">optional</span>}
        </label>
        {labelAction}
      </div>
      {child}
      {(error || hint) && (
        <p id={descId} className={cn("text-[12.5px] leading-snug", error ? "text-loss-text" : "text-ink-3")} role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...rest} />;
});

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(
  { className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? "text" : "password"} className={cn(control, "h-12 pr-12", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, "resize-y py-3 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-12 appearance-none pr-10 [&>option]:bg-[#121214]", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
});

/** Inline form-level error banner. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[14px] border border-loss/40 bg-loss/10 px-4 py-3 text-[14px] text-loss-text">
      {children}
    </div>
  );
}
