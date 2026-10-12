import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
