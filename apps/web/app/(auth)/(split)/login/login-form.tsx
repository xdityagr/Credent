"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button, Field, FormError, Input, PasswordInput } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { emailSchema, homeFor, useDemoLogin, useLogin, useResendVerification } from "@/lib/auth";
import { cn } from "@/lib/cn";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const highlightDemo = params.get("demo") === "1";
  const login = useLogin();
  const demo = useDemoLogin();
  const resend = useResendVerification();
  const [unverified, setUnverified] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "", password: "" } });

  const onSubmit = form.handleSubmit(async (v) => {
    setUnverified(null);
    try {
      const me = await login.mutateAsync(v);
      router.replace(homeFor(me, next));
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") setUnverified(v.email);
    }
  });

  const loginError =
    login.error instanceof ApiError && login.error.code === "INVALID_CREDENTIALS"
      ? "That email and password don't match an account."
      : login.error instanceof ApiError && login.error.code === "EMAIL_NOT_VERIFIED"
        ? null
        : login.error
          ? errorMessage(login.error)
          : null;

  return (
    <>
      <AuthHeading title="Welcome back" description="Log in to your Credent account." />

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError>{loginError}</FormError>
        {unverified && (
          <div role="alert" className="rounded-[14px] border border-warn/35 bg-warn/10 px-4 py-3 text-[14px] text-ink">
            Confirm your email before logging in. We sent a link to <span className="text-white">{unverified}</span>.
            <div className="mt-2">
              {resend.isSuccess ? (
                <span className="text-junior-text">Sent. Check your inbox.</span>
              ) : (
                <button
                  type="button"
                  onClick={() => resend.mutate(unverified)}
                  disabled={resend.isPending}
                  className="text-warn underline underline-offset-4 hover:text-white"
                >
                  {resend.isPending ? "Sending…" : "Send the link again"}
                </button>
              )}
            </div>
          </div>
        )}
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          error={form.formState.errors.password?.message}
          labelAction={
            <Link href="/forgot-password" className="text-[13px] text-ink-2 transition hover:text-ink">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </Field>
        <Button type="submit" variant="white" size="lg" busy={login.isPending} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-ink-2">
        New to Credent?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-ink underline underline-offset-4 hover:text-white">
          Create an account
        </Link>
      </p>

      <div
        className={cn(
          "mt-10 rounded-[24px] border border-line p-5 transition-colors",
          highlightDemo && "border-ember-1/40 bg-ember-1/[0.04] shadow-[0_0_60px_-20px_rgb(255_138_61/0.5)]",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] text-ink">Try the demo</h2>
          <span className="text-[12.5px] text-ink-3">No signup, seeded data</span>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">Step into a seeded company and click through the whole flow.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { role: "borrower", label: "As a business", icon: Building2, cls: "hover:border-ember-1/50" },
              { role: "lender", label: "As a lender", icon: Landmark, cls: "hover:border-horizon-2/50" },
            ] as const
          ).map((d) => (
            <button
              key={d.role}
              type="button"
              disabled={demo.isPending}
              onClick={async () => {
                try {
                  const me = await demo.mutateAsync(d.role);
                  router.replace(me && "user" in me ? homeFor(me, "/app") : "/app");
                } catch {
                  /* shown below */
                }
              }}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white/[0.03] text-[14px] text-ink transition active:scale-[0.97] disabled:opacity-50",
                d.cls,
              )}
            >
              <d.icon className="size-4 text-ink-2" />
              {demo.isPending && demo.variables === d.role ? "Opening…" : d.label}
            </button>
          ))}
        </div>
        {demo.error && <p className="mt-3 text-[13px] text-loss-text">{errorMessage(demo.error)}</p>}
      </div>
    </>
  );
}
