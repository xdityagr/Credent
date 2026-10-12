"use client";

import { Inbox } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Applications"
        description={"Every application you've sent and where it stands: in review, approved, declined or drawn."}
        preview="table"
        empty={
          <EmptyState
            tone="ember"
            icon={<Inbox />}
            title={"No applications yet"}
            body={"Apply to a pool with a valid revenue proof. Approved terms wait here for you to sign with your wallet."}
            action={
              <ButtonLink href="/app/pools" size="sm" variant="ember">
                Find a pool
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
