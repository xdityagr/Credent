"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { Profile } from "@/lib/types";
import { Button, Notice } from "../ui";

type Method = "stripe" | "receipts";

export function SourceStep({ token, onDone }: { token: string; onDone: () => void }) {
  const { data: profiles } = useApi<Profile[]>("/public/profiles");
  const [profile, setProfile] = useState("saas");
  const [method, setMethod] = useState<Method>("stripe");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(tampered: boolean) {
    setBusy(tampered ? "dl-bad" : "dl");
    setError(null);
    try {
      const rows = await api<unknown[]>(`/borrower/sample-receipts?profile=${profile}&tampered=${tampered}`, { token });
      const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts-${profile}${tampered ? "-tampered" : ""}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      if (method === "stripe") {
        await api("/borrower/sources/stripe", { body: { profile }, token });
      } else {
        if (!file) throw new Error("Choose a receipts file first.");
        const form = new FormData();
        form.append("file", file);
        form.append("profile", profile);
        await api("/borrower/sources/receipts", { form, token });
      }
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold text-ink">Which business are you?</legend>
        <p className="-mt-2 mb-3 text-[14px] text-ink-faint">
          Demo profiles drive the simulated customer payments after you borrow.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(profiles ?? []).map((p) => (
            <label
              key={p.key}
              className={`cursor-pointer rounded-[4px] border px-4 py-3 transition-colors ${
                profile === p.key ? "border-ink bg-sheet" : "border-rule hover:border-rule-strong"
              }`}
            >
              <input type="radio" name="profile" value={p.key} checked={profile === p.key} onChange={() => setProfile(p.key)} className="sr-only" />
              <span className="block text-[15px] font-semibold text-ink">{p.label}</span>
              <span className="block text-[13px] text-ink-soft">{p.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold text-ink">Where should we read revenue from?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <MethodCard
            active={method === "stripe"}
            onClick={() => setMethod("stripe")}
            title="Connect Stripe"
            body="A zkTLS notary witnesses your Stripe session and signs a commitment to 90 days of revenue. Simulated in this demo."
          />
          <MethodCard
            active={method === "receipts"}
            onClick={() => setMethod("receipts")}
            title="Upload signed receipts"
            body="Payment receipts carry your processor's signature. Any edited receipt fails verification."
          />
        </div>
      </fieldset>

      {method === "receipts" && (
        <div className="space-y-3 rounded-[4px] border border-rule bg-paper p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" busy={busy === "dl"} onClick={() => download(false)}>
              Download sample receipts
            </Button>
            <Button variant="quiet" busy={busy === "dl-bad"} onClick={() => download(true)}>
              Download a tampered copy
            </Button>
          </div>
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-[14px] text-ink-soft file:mr-3 file:rounded-[4px] file:border file:border-rule-strong file:bg-sheet file:px-3 file:py-1.5 file:text-[14px] file:font-semibold file:text-ink"
          />
        </div>
      )}

      {error && <Notice>{error}</Notice>}
      <Button busy={busy === "connect"} onClick={connect} disabled={method === "receipts" && !file}>
        {method === "stripe" ? "Connect Stripe" : "Verify receipts"}
      </Button>
    </div>
  );
}

function MethodCard({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[4px] border px-4 py-3 text-left transition-colors ${
        active ? "border-ink bg-sheet" : "border-rule hover:border-rule-strong"
      }`}
    >
      <span className="block text-[15px] font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">{body}</span>
    </button>
  );
}
