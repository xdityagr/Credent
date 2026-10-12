"use client";

import { ArrowLeftRight } from "lucide-react";
import { PlaceholderPage, RoleGate } from "@/components/app/kit";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function Page() {
  return (
    <RoleGate kind="BORROWER">
      <PlaceholderPage
        title="Payments"
        description={"Customer payments through your lockbox: what went to the installment and what was released to you."}
        preview="table"
        empty={
          <EmptyState
            tone="ember"
            icon={<ArrowLeftRight />}
            title={"No payments yet"}
            body={"Payments appear once a loan is active and your revenue source reports new sales. Released amounts collect in an operating balance you can withdraw."}
            action={
              <ButtonLink href="/app/revenue" size="sm" variant="ember">
                Connect revenue
              </ButtonLink>
            }
          />
        }
      />
    </RoleGate>
  );
}
