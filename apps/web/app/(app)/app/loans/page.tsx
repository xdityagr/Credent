"use client";

import { FileText } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Loans"
        description={"Active and past loans with their weekly schedule, lockbox progress and Solana transactions."}
        preview="table"
        empty={
          <EmptyState
            tone="ember"
            icon={<FileText />}
            title={"No loans yet"}
            body={"Accept an approved application to draw cUSD into your wallet. The loan, its schedule and each weekly installment appear here."}
            action={
              <ButtonLink href="/app/applications" size="sm" variant="ember">
                See applications
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
