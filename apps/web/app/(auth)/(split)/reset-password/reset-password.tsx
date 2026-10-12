"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthHeading, AuthStatus } from "@/components/auth/auth-heading";
import { Button, ButtonLink, Field, FormError, PasswordInput } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { passwordSchema, useResetPassword } from "@/lib/auth";

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });
type Values = z.infer<typeof schema>;

export function ResetPassword() {
  const token = useSearchParams().get("token");
  const reset = useResetPassword();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }, mode: "onTouched" });

  if (!token) {
    return (
      <AuthStatus icon={<KeyRound />} title="This reset link is incomplete">
        <p>Open the link from your email again, or request a new one.</p>
        <ButtonLink href="/forgot-password" variant="white" size="lg" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthStatus>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthStatus icon={<CheckCircle2 />} title="Password updated" tone="good">
        <p>You&apos;ve been signed out everywhere else. Log in with your new password.</p>
        <ButtonLink href="/login" variant="white" size="lg" className="w-full">
          Log in
        </ButtonLink>
      </AuthStatus>
    );
  }

  const err =
    reset.error instanceof ApiError && reset.error.code === "TOKEN_INVALID"
      ? "This reset link has expired or was already used. Request a new one."
      : reset.error
        ? errorMessage(reset.error)
        : null;

  return (
    <>
      <AuthHeading title="Choose a new password" description="Pick something you don't use anywhere else." />
      <form onSubmit={form.handleSubmit((v) => reset.mutate({ token, password: v.password }))} noValidate className="space-y-5">
        <FormError>{err}</FormError>
        <Field label="New password" hint="At least 10 characters, with upper and lower case letters and a number." error={form.formState.errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirm new password" error={form.formState.errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <Button type="submit" variant="white" size="lg" busy={reset.isPending} className="w-full">
          Update password
        </Button>
      </form>
    </>
  );
}
