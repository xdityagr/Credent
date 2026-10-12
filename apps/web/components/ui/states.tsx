"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage, isUnavailable } from "@/lib/api";
import { Button } from "./button";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={cn("skeleton block h-4", className)} style={style} />;
}

/** A skeleton the width of a number, for stats when the API hasn't answered yet. */
export function NumberSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("inline-block h-[0.8em] w-[4.5ch] translate-y-[0.1em] rounded-md", className)} />;
}

/**
 * EmptyState: the screen's next step, not a mood. Always pair it with the
 * action that fills it.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  tone?: "neutral" | "ember" | "horizon";
  className?: string;
}) {
  const glow =
    tone === "ember"
      ? "radial-gradient(50% 60% at 50% 0%, rgb(255 138 61 / 0.12), transparent 70%)"
      : tone === "horizon"
        ? "radial-gradient(50% 60% at 50% 0%, rgb(45 91 255 / 0.14), transparent 70%)"
        : "radial-gradient(50% 60% at 50% 0%, rgb(255 255 255 / 0.05), transparent 70%)";
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-line-strong px-6 py-14 text-center",
        className,
      )}
      style={{ background: glow }}
    >
      {icon && (
        <span
          className={cn(
            "glass mb-5 inline-flex size-12 items-center justify-center rounded-[14px] [&_svg]:size-5",
            tone === "ember" ? "text-ember-1" : tone === "horizon" ? "text-horizon-2" : "text-ink-2",
          )}
        >
          {icon}
        </span>
      )}
      <h3 className="text-[17px] font-medium text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-ink-2">{body}</p>}
      {(action || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const offline = isUnavailable(error);
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-[16px] border border-line-strong bg-raised px-4 py-3.5 text-[14px]",
        compact ? "" : "py-4",
        className,
      )}
    >
      <AlertCircle className={cn("mt-0.5 size-4 shrink-0", offline || missing ? "text-warn" : "text-loss-text")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-ink">{offline || missing ? "Live data is unavailable" : "Couldn't load this"}</p>
        <p className="mt-0.5 text-ink-2">
          {offline
            ? "The Credent API isn't reachable right now. This view refreshes on its own when it's back."
            : missing
              ? "The API doesn't serve this view yet. It will fill in once that endpoint is live."
              : errorMessage(error)}
        </p>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} icon={<RefreshCw className="size-3.5" />}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Generic "loaded / loading / error" switch for a query. */
export function QueryView<T>({
  query,
  loading,
  empty,
  isEmpty,
  children,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  loading: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <>{loading}</>;
  if (query.error || query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
