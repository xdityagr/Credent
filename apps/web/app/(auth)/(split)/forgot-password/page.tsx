"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthHeading, AuthStatus } from "@/components/auth/auth-heading";
import { Button, ButtonLink, Field, FormError, Input } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { emailSchema, useForgotPassword } from "@/lib/auth";

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  if (forgot.isSuccess) {
    return (
      <AuthStatus icon={<MailCheck />} title="Check your inbox" tone="ember">
        <p>
          If an account exists for <span className="text-ink">{forgot.variables}</span>, a link to choose a new password is on its
          way. It expires in an hour.
        </p>
        <ButtonLink href="/login" variant="white" size="lg" className="w-full">
          Back to log in
        </ButtonLink>
      </AuthStatus>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter the email you signed up with and we'll send you a reset link." />
      <form onSubmit={form.handleSubmit((v) => forgot.mutate(v.email))} noValidate className="space-y-5">
        <FormError>{forgot.error ? errorMessage(forgot.error) : null}</FormError>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
        </Field>
        <Button type="submit" variant="white" size="lg" busy={forgot.isPending} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        Remembered it?{" "}
        <Link href="/login" className="text-ink underline underline-offset-4 hover:text-white">
          Log in
        </Link>
      </p>
    </>
  );
}
