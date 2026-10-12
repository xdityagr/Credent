"use client";

import { LineChart } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Revenue"
        description={"Connect where your revenue comes from. Credent only ever publishes a threshold you choose; the figures stay with you."}
        preview="cards"
        empty={
          <EmptyState
            tone="ember"
            icon={<LineChart />}
            title={"No revenue source connected"}
            body={"Connect Stripe in test mode through a zkTLS notary, upload signed payment receipts, or start with a demo business to try the whole flow."}
            action={
              <ButtonLink href="/app/revenue" size="sm" variant="ember">
                Connect a source
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
