"use client";

import { Store } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Pools"
        description={"Pools you can apply to. Each shows its APR, advance rate, term and the minimum revenue it lends against."}
        preview="cards"
        empty={
          <EmptyState
            tone="horizon"
            icon={<Store />}
            title={"Pick a pool to apply to"}
            body={"Browse open pools and compare terms. When you apply, your latest proof and company profile go to that pool's manager only."}
            action={
              <ButtonLink href="/pools" size="sm" variant="horizon">
                Browse open pools
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
