"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { post } from "./api";
import { qk } from "./queries";
import type { Me } from "./types";

export const emailSchema = z.string().trim().min(1, "Enter your email").email("Enter a valid email address");
/** Mirrors the API's password_problem(): 10+ chars, mixed case, a digit. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use 128 characters or fewer")
  .refine((pw) => pw.toLowerCase() !== pw && pw.toUpperCase() !== pw && /\d/.test(pw), {
    message: "Mix upper and lower case letters and at least one number",
  });

/** Where a signed-in user belongs right now. */
export function homeFor(me: Me | null | undefined, next?: string | null): string {
  if (!me) return "/login";
  if (!me.user.email_verified || me.onboarding.step === "verify_email") return `/verify-email?email=${encodeURIComponent(me.user.email)}`;
  if (me.onboarding.step !== "done") return "/onboarding";
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/app";
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => post<Me>("/auth/login", v),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useDemoLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: "borrower" | "lender") => post<Me>("/auth/demo", { role }),
    onSuccess: (me) => {
      if (me && typeof me === "object" && "user" in me) qc.setQueryData(qk.me, me);
      else qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useSignup() {
  return useMutation({ mutationFn: (v: { email: string; password: string; name: string }) => post<{ ok: true }>("/auth/signup", v) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: (email: string) => post<{ ok: true }>("/auth/resend-verification", { email }) });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    // the API signs the user in on success and returns Me
    mutationFn: (token: string) => post<Me>("/auth/verify-email", { token }),
    onSuccess: (me) => {
      if (me && typeof me === "object" && "user" in me) qc.setQueryData(qk.me, me);
      else qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => post<{ ok: true }>("/auth/forgot-password", { email }) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (v: { token: string; password: string }) => post<{ ok: true }>("/auth/reset-password", v) });
}
