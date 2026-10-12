"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { errorMessage } from "@/lib/api";

export const SECTORS = [
  "Software and SaaS",
  "E-commerce",
  "Retail",
  "Food and beverage",
  "Health and wellness",
  "Professional services",
  "Manufacturing",
  "Logistics",
  "Media and creative",
  "Hospitality",
  "Credit fund or asset manager",
  "Family office",
  "Fintech lender",
  "Other",
];

export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Ireland",
  "Spain",
  "Singapore",
  "India",
  "United Arab Emirates",
  "Australia",
  "Brazil",
  "Nigeria",
  "Kenya",
  "Other",
];

export const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter your company's name").max(80, "Use 80 characters or fewer"),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Start with https:// (e.g. https://example.com)"),
  sector: z.string().min(1, "Choose a sector"),
  country: z.string().min(1, "Choose a country"),
  description: z.string().trim().max(1200, "Use 1,200 characters or fewer"),
});
export type OrgValues = z.infer<typeof orgSchema>;

export function OrgForm({
  defaultValues,
  kind,
  submitLabel,
  onSubmit,
  busy,
  error,
  secondary,
}: {
  defaultValues?: Partial<OrgValues>;
  kind: "BORROWER" | "LENDER";
  submitLabel: string;
  onSubmit: (v: OrgValues) => void | Promise<void>;
  busy?: boolean;
  error?: unknown;
  secondary?: React.ReactNode;
}) {
  const form = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: "", website: "", sector: "", country: "", description: "", ...defaultValues },
    mode: "onTouched",
  });
  const e = form.formState.errors;
  const desc = useWatch({ control: form.control, name: "description" }) ?? "";
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormError>{error ? errorMessage(error) : null}</FormError>
      <Field label="Company name" error={e.name?.message}>
        <Input autoComplete="organization" placeholder={kind === "LENDER" ? "Harbor Credit Partners" : "Juniper Ceramics"} {...form.register("name")} />
      </Field>
      <Field label="Website" optional error={e.website?.message}>
        <Input type="url" inputMode="url" placeholder="https://" {...form.register("website")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sector" error={e.sector?.message}>
          <Select {...form.register("sector")}>
            <option value="">Choose…</option>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Country" error={e.country?.message}>
          <Select autoComplete="country-name" {...form.register("country")}>
            <option value="">Choose…</option>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="What does the company do?"
        optional
        hint={
          kind === "LENDER"
            ? `Shown on your public lender profile. ${desc.length}/1200`
            : `Shared only with pools you apply to, never on the public ledger. ${desc.length}/1200`
        }
        error={e.description?.message}
      >
        <Textarea
          rows={4}
          placeholder={kind === "LENDER" ? "We lend to profitable small businesses in…" : "We make and sell stoneware to cafés and retailers…"}
          {...form.register("description")}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {secondary ?? <span />}
        <Button type="submit" variant="white" size="lg" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
