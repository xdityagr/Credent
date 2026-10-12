"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { ReviewCard } from "@/components/app/review";
import { ButtonLink, EmptyState, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { useReviewQueue } from "@/lib/portal";

export default function ReviewPage() {
  const [status, setStatus] = useState<"SUBMITTED" | "">("SUBMITTED");
  const q = useReviewQueue(status);
  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <PageHeader
          title="Review queue"
          description="Applications to your pools. You see who is applying and what they proved, never their revenue."
          actions={
            <Segmented
              label="Show"
              value={status}
              onChange={setStatus}
              options={[
                { value: "SUBMITTED", label: "Waiting" },
                { value: "", label: "All" },
              ]}
            />
          }
        />
        {q.isPending ? (
          <Skeleton className="h-64 w-full rounded-[20px]" />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            tone="horizon"
            icon={<ClipboardCheck />}
            title={status ? "Nothing waiting for you" : "No applications yet"}
            body="New applications to your open pools show up here. Pools with auto-approval don't need you."
            action={<ButtonLink href="/app/my-pools" size="sm" variant="horizon">My pools</ButtonLink>}
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">{q.data!.map((a) => <ReviewCard key={a.id} app={a} />)}</div>
        )}
      </div>
    </RoleGate>
  );
}
