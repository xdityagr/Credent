"use client";

import { ClipboardCheck } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="LENDER">
      <PlaceholderPage
        title="Review queue"
        description={"Applications waiting for your decision, with the revenue proof, company profile and Credent track record."}
        preview="table"
        empty={
          <EmptyState
            tone="horizon"
            icon={<ClipboardCheck />}
            title={"Nothing to review"}
            body={"Applications to your open pools land here. You'll see the verified proof and the business's profile, never its books."}
            action={
              <ButtonLink href="/app/my-pools" size="sm" variant="horizon">
                View my pools
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
