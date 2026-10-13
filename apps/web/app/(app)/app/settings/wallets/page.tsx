"use client";

import { Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { WalletIdentity } from "@/components/app/wallet-identity";
import { WalletLink } from "@/components/app/wallet-link";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Panel,
  PanelHeader,
  StatusPill,
  toast,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { date } from "@/lib/format";
import { useWalletMutations } from "@/lib/queries";
import { useSession } from "@/lib/session";

export default function WalletSettings() {
  const me = useSession();
  const m = useWalletMutations();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Linked wallets"
          description="Your primary wallet receives drawdowns, withdrawals and faucet mints. Credent pays all network fees."
          action={
            !adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                Link another wallet
              </Button>
            )
          }
        />
        <ul className="divide-y divide-line px-5 pb-2 pt-3 md:px-6">
          {me.wallets.length === 0 && <li className="py-6 text-[14px] text-ink-3">No wallets linked yet.</li>}
          {me.wallets.map((w) => (
            <li key={w.address} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <WalletIdentity wallet={w} />
                  {w.is_primary && <StatusPill tone="public">Primary</StatusPill>}
                  <StatusPill tone={w.kind === "CUSTODIAL" ? "private" : "neutral"} icon={false}>
                    {w.kind === "CUSTODIAL" ? "Custodial" : "Self-custody"}
                  </StatusPill>
                </div>
                <div className="mt-1.5 pl-12 text-[12.5px] text-ink-3">Linked {date(w.verified_at)}</div>
              </div>
              <div className="flex gap-1">
                {!w.is_primary && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Star className="size-3.5" />}
                    busy={m.makePrimary.isPending && m.makePrimary.variables === w.address}
                    onClick={() =>
                      m.makePrimary.mutate(w.address, {
                        onSuccess: () => toast.success("Primary wallet changed"),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    Make primary
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} disabled={w.is_primary && me.wallets.length > 1}>
                      Remove
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    title="Remove this wallet?"
                    description="It will no longer receive funds from Credent. Tokens already in it stay where they are."
                  >
                    <div className="flex justify-end gap-2 pt-2">
                      <DialogClose asChild>
                        <Button variant="ghost">Keep it</Button>
                      </DialogClose>
                      <Button
                        variant="danger"
                        busy={m.remove.isPending}
                        onClick={() =>
                          m.remove.mutate(w.address, {
                            onSuccess: () => toast.success("Wallet removed"),
                            onError: (e) => toast.error("Couldn't remove wallet", { description: errorMessage(e) }),
                          })
                        }
                      >
                        Remove wallet
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      {(adding || me.wallets.length === 0) && (
        <Panel>
          <PanelHeader title="Link a wallet" description="Connect Phantom or Solflare on devnet and sign a one-time message. No transaction, no fee." />
          <div className="p-5 md:p-6">
            <WalletLink allowCustodial={!me.wallets.some((w) => w.kind === "CUSTODIAL")} onLinked={() => setAdding(false)} />
          </div>
        </Panel>
      )}
    </div>
  );
}
