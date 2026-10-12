"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, FormError, Input, Panel, PanelHeader, StatusPill, toast } from "@/components/ui";
import { errorMessage, patch } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

const schema = z.object({ name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer") });

export default function ProfileSettings() {
  const me = useSession();
  const qc = useQueryClient();
  const form = useForm<{ name: string }>({ resolver: zodResolver(schema), defaultValues: { name: me.user.name } });
  const save = useMutation({
    mutationFn: (v: { name: string }) => patch<Me>("/me", v),
    onSuccess: (data, v) => {
      if (data && "user" in data) qc.setQueryData(qk.me, data);
      else qc.invalidateQueries({ queryKey: qk.me });
      form.reset(v);
      toast.success("Profile saved");
    },
  });
  return (
    <Panel>
      <PanelHeader title="Profile" description="How you appear to your own team. Never shown on the public ledger." />
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-5 p-5 md:p-6">
        <FormError>{save.error ? errorMessage(save.error) : null}</FormError>
        <Field label="Name" error={form.formState.errors.name?.message}>
          <Input autoComplete="name" {...form.register("name")} />
        </Field>
        <Field label="Email" hint="Contact support to change the email on your account.">
          <Input value={me.user.email} readOnly disabled />
        </Field>
        <div className="flex items-center justify-between gap-3">
          {me.user.email_verified ? <StatusPill tone="good">Email confirmed</StatusPill> : <StatusPill tone="warn">Email not confirmed</StatusPill>}
          <Button type="submit" variant="white" busy={save.isPending} disabled={!form.formState.isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}
