"use client";

import { FileCheck2 } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Proofs"
        description={"Zero-knowledge proofs that your 90-day revenue clears a threshold. Proofs expire after 30 days."}
        preview="table"
        empty={
          <EmptyState
            tone="ember"
            icon={<FileCheck2 />}
            title={"No revenue proofs yet"}
            body={"Once a revenue source is connected, pick a threshold and Credent generates a Noir proof. Lenders can verify it without seeing your numbers."}
            action={
              <ButtonLink href="/app/revenue" size="sm" variant="ember">
                Connect revenue first
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
