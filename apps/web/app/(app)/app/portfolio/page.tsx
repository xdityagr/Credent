"use client";

import { BriefcaseBusiness } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="LENDER">
      <PlaceholderPage
        title="Portfolio"
        description={"Your positions by pool and tranche: deposited, current value and return."}
        preview="table"
        empty={
          <EmptyState
            tone="horizon"
            icon={<BriefcaseBusiness />}
            title={"No positions yet"}
            body={"Deposit into a senior or junior tranche of any pool, including your own. Positions are priced from the public share price."}
            action={
              <ButtonLink href="/pools" size="sm" variant="horizon">
                Browse pools
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
