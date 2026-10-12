"use client";

import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/cn";

// ---------------- Dialog ----------------

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_ease]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-line-strong bg-[linear-gradient(180deg,#141416,#0b0b0c)] p-6 shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] outline-none data-[state=open]:animate-[pop-in_260ms_var(--ease-out-expo)]",
          className,
        )}
      >
        <div className="mb-4 pr-8">
          <D.Title className="text-[18px] font-medium text-ink">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
          )}
        </div>
        {children}
        <D.Close
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-ink-3 transition hover:bg-white/5 hover:text-ink"
          aria-label="Close"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

// ---------------- Sheet (side drawer) ----------------

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  title,
  description,
  side = "right",
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: "right" | "left";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-[81] flex w-[min(420px,100vw)] flex-col border-line-strong bg-[#0b0b0c] shadow-2xl outline-none",
          side === "right"
            ? "right-0 border-l data-[state=open]:animate-[slide-in-right_320ms_var(--ease-out-expo)]"
            : "left-0 border-r data-[state=open]:animate-[slide-in-left_320ms_var(--ease-out-expo)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <D.Title className="text-[16px] font-medium text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-[13px] text-ink-2">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Panel"}</D.Description>
            )}
          </div>
          <D.Close
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-3 transition hover:bg-white/5 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
          {children}
        </div>
      </D.Content>
    </D.Portal>
  );
}

// ---------------- Menu ----------------

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-[90] min-w-[220px] rounded-[18px] border border-line-strong bg-[#101012]/95 p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl data-[state=open]:animate-[pop-in_180ms_var(--ease-out-expo)]",
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
}: {
  children: React.ReactNode;
  onSelect?: (e: Event) => void;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-default select-none items-center gap-2.5 rounded-[12px] px-3 py-2 text-[14px] outline-none transition-colors data-[highlighted]:bg-white/[0.07] [&_svg]:size-4",
        danger ? "text-loss-text" : "text-ink-2 data-[highlighted]:text-ink",
      )}
    >
      {icon}
      {children}
    </M.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-3 pb-2 pt-1.5">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1.5 h-px bg-line" />;
}
