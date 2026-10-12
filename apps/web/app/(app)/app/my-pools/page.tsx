"use client";

import { Layers } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="LENDER">
      <PlaceholderPage
        title="My pools"
        description={"Pools you manage: their terms, capital stack, loans and investors."}
        preview="cards"
        empty={
          <EmptyState
            tone="horizon"
            icon={<Layers />}
            title={"You don't manage a pool yet"}
            body={"Set a target size, senior coupon, borrower APR, advance rate, term and minimum proven revenue. Fund junior first, then open the pool for applications."}
            action={
              <ButtonLink href="/app/my-pools" size="sm" variant="horizon">
                Create a pool
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
