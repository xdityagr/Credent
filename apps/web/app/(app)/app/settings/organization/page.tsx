"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogoUpload } from "@/components/app/logo-upload";
import { OrgForm, type OrgValues } from "@/components/app/org-form";
import { Panel, PanelHeader, toast } from "@/components/ui";
import { patch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { Org } from "@/lib/types";

export default function OrganizationSettings() {
  const me = useSession();
  const org = me.org;
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (v: OrgValues) => patch<Org>("/orgs/me", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Organization saved");
    },
  });
  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Logo" description="PNG, JPG or WebP up to 1 MB." />
        <div className="p-5 md:p-6">
          <LogoUpload org={org} compact onUploaded={() => toast.success("Logo updated")} />
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Company details"
          description={
            <>
              {org.kind === "LENDER" ? "Lender" : "Borrower"} company. On the public ledger you appear as{" "}
              <span className="font-mono text-ink">{org.pseudonym}</span>
              {org.kind === "LENDER" ? "; these details are on your public profile." : "; these details go only to pools you apply to."}
            </>
          }
        />
        <div className="p-5 md:p-6">
          <OrgForm
            key={org.id}
            kind={org.kind}
            submitLabel="Save changes"
            busy={save.isPending}
            error={save.error}
            defaultValues={{
              name: org.name,
              website: org.website ?? "",
              sector: org.sector ?? "",
              country: org.country ?? "",
              description: org.description ?? "",
            }}
            onSubmit={(v) => save.mutate(v)}
          />
        </div>
      </Panel>
    </div>
  );
}
