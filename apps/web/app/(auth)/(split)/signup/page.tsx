"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button, Field, FormError, Input, PasswordInput } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { emailSchema, passwordSchema, useSignup } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
  email: emailSchema,
  password: passwordSchema,
});
type Values = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" }, mode: "onTouched" });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await signup.mutateAsync(v);
      router.push(`/verify-email?email=${encodeURIComponent(v.email)}&sent=1`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_TAKEN") form.setError("email", { message: "An account with this email already exists. Log in instead." });
      else if (e instanceof ApiError && e.code === "WEAK_PASSWORD") form.setError("password", { message: e.message });
    }
  });

  const general =
    signup.error && !(signup.error instanceof ApiError && ["EMAIL_TAKEN", "WEAK_PASSWORD"].includes(signup.error.code))
      ? errorMessage(signup.error)
      : null;

  return (
    <>
      <AuthHeading title="Create your account" description="You'll confirm your email, then set up your company as a borrower or a lender." />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError>{general}</FormError>
        <Field label="Your name" error={form.formState.errors.name?.message}>
          <Input autoComplete="name" placeholder="Ada Okafor" {...form.register("name")} />
        </Field>
        <Field label="Work email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@company.com" {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          hint="At least 10 characters, with upper and lower case letters and a number."
          error={form.formState.errors.password?.message}
        >
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Button type="submit" variant="white" size="lg" busy={signup.isPending} className="w-full">
          Create account
        </Button>
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Credent runs on Solana devnet with test tokens. Creating an account doesn&apos;t commit you to borrowing or lending.
        </p>
      </form>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline underline-offset-4 hover:text-white">
          Log in
        </Link>
      </p>
    </>
  );
}
