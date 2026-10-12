"use client";

import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthStatus } from "@/components/auth/auth-heading";
import { Button, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { homeFor, useResendVerification, useVerifyEmail } from "@/lib/auth";
import { useMe } from "@/lib/queries";

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  return token ? <ConsumeToken token={token} /> : <CheckInbox initialEmail={params.get("email") ?? ""} />;
}

function ConsumeToken({ token }: { token: string }) {
  const router = useRouter();
  const verify = useVerifyEmail();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (verify.isError) {
    return (
      <AuthStatus icon={<XCircle />} title="This link didn't work" tone="loss">
        <p>{errorMessage(verify.error)} Links expire after a while and can only be used once.</p>
        <ResendForm initialEmail="" />
      </AuthStatus>
    );
  }
  if (verify.isSuccess) {
    const me = verify.data && "user" in verify.data ? verify.data : null;
    return (
      <AuthStatus icon={<CheckCircle2 />} title="Email confirmed" tone="good">
        <p>Your account is active. Next, set up your company and link a wallet.</p>
        <Button variant="white" size="lg" className="w-full" onClick={() => router.replace(me ? homeFor(me) : "/login")}>
          {me ? "Set up your company" : "Log in"}
        </Button>
      </AuthStatus>
    );
  }
  return (
    <AuthStatus icon={<Loader2 className="animate-spin" />} title="Confirming your email…">
      <p>This takes a second.</p>
    </AuthStatus>
  );
}

function CheckInbox({ initialEmail }: { initialEmail: string }) {
  const { data: me } = useMe();
  const email = initialEmail || me?.user.email || "";
  return (
    <AuthStatus icon={<MailCheck />} title="Check your inbox" tone="ember">
      <p>
        We sent a confirmation link to {email ? <span className="text-ink">{email}</span> : "your email address"}. Open it on
        this device to activate your account.
      </p>
      <p className="text-[13.5px] text-ink-3">
        Running locally? Emails land in Mailpit at{" "}
        <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          localhost:8025
        </a>
        .
      </p>
      <ResendForm initialEmail={email} />
      <p className="text-[14px]">
        Wrong address?{" "}
        <Link href="/signup" className="text-ink underline underline-offset-4 hover:text-white">
          Sign up again
        </Link>
      </p>
    </AuthStatus>
  );
}

function ResendForm({ initialEmail }: { initialEmail: string }) {
  const resend = useResendVerification();
  const [email, setEmail] = useState(initialEmail);
  return (
    <form
      className="space-y-3 rounded-[20px] border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) resend.mutate(email.trim());
      }}
    >
      <Field label="Didn't get it?" error={resend.error ? errorMessage(resend.error) : undefined}>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
      </Field>
      {resend.isSuccess ? (
        <p className="text-[14px] text-junior-text">A new link is on its way.</p>
      ) : (
        <Button type="submit" busy={resend.isPending} className="w-full">
          Send a new link
        </Button>
      )}
    </form>
  );
}

