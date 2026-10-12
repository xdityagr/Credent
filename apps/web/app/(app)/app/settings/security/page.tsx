"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Laptop, Smartphone } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, ErrorState, Field, FormError, Panel, PanelHeader, PasswordInput, Skeleton, StatusPill, toast } from "@/components/ui";
import { ApiError, del, errorMessage, post } from "@/lib/api";
import { passwordSchema } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { qk, useSessions } from "@/lib/queries";

const schema = z
  .object({ current: z.string().min(1, "Enter your current password"), next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match" });
type Values = z.infer<typeof schema>;

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default function SecuritySettings() {
  const qc = useQueryClient();
  const sessions = useSessions();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current: "", next: "", confirm: "" }, mode: "onTouched" });
  const change = useMutation({
    mutationFn: (v: Values) => post("/me/password", { current: v.current, new: v.next }),
    onSuccess: () => {
      form.reset();
      toast.success("Password changed");
      qc.invalidateQueries({ queryKey: qk.sessions });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "INVALID_CREDENTIALS") form.setError("current", { message: "That isn't your current password." });
      if (e instanceof ApiError && e.code === "WEAK_PASSWORD") form.setError("next", { message: e.message });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/me/sessions/${id}`),
    onSuccess: () => {
      toast.success("Signed out that session");
      qc.invalidateQueries({ queryKey: qk.sessions });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const formError =
    change.error && !(change.error instanceof ApiError && ["INVALID_CREDENTIALS", "WEAK_PASSWORD"].includes(change.error.code)) ? errorMessage(change.error) : null;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Password" description="At least 10 characters, with upper and lower case letters and a number." />
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate className="space-y-5 p-5 md:p-6">
          <FormError>{formError}</FormError>
          <Field label="Current password" error={form.formState.errors.current?.message}>
            <PasswordInput autoComplete="current-password" {...form.register("current")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New password" error={form.formState.errors.next?.message}>
              <PasswordInput autoComplete="new-password" {...form.register("next")} />
            </Field>
            <Field label="Confirm new password" error={form.formState.errors.confirm?.message}>
              <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="white" busy={change.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Active sessions" description="Everywhere you're signed in. Sign out any session you don't recognise." />
        <div className="px-5 pb-3 pt-2 md:px-6">
          {sessions.isPending ? (
            <div className="space-y-3 py-3">
              <Skeleton className="h-12 rounded-[14px]" />
              <Skeleton className="h-12 rounded-[14px]" />
            </div>
          ) : sessions.error ? (
            <div className="py-3">
              <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} compact />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(sessions.data ?? []).map((s) => {
                const mobile = /Mobile|Android|iPhone/.test(s.user_agent ?? "");
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                    <span className="glass inline-flex size-10 items-center justify-center rounded-[12px] text-ink-2">
                      {mobile ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[14px] text-ink">
                        {device(s.user_agent)}
                        {s.current && <StatusPill tone="good">This device</StatusPill>}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-ink-3">
                        Signed in {dateTime(s.created_at)}
                        {s.ip ? `, from ${s.ip}` : ""}
                      </div>
                    </div>
                    {!s.current && (
                      <Button size="sm" variant="ghost" busy={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                        Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
