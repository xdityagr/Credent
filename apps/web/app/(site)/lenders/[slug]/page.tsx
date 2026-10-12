"use client";

import { ArrowLeft, Globe, Layers } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PoolCard } from "@/components/data/pool-card";
import { Container } from "@/components/site/page-hero";
import { ButtonLink, ColumnLines, EmptyState, ErrorState, OrgAvatar, Skeleton } from "@/components/ui";
import { useOrgProfile } from "@/lib/queries";

export default function LenderPage() {
  const { slug } = useParams<{ slug: string }>();
  const q = useOrgProfile(slug);
  const o = q.data;
  return (
    <>
      <section className="relative isolate overflow-hidden pt-[76px]">
        <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000,transparent)]" />
        <Container className="pb-10 pt-10 md:pt-14">
          <Link href="/pools" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 transition hover:text-ink">
            <ArrowLeft className="size-4" /> All pools
          </Link>
          {o ? (
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <OrgAvatar name={o.name} src={o.logo_url} kind={o.kind} size={88} />
              <div className="min-w-0">
                <h1 className="font-serif text-[clamp(40px,5vw,68px)] leading-none tracking-[-0.03em] text-[#f4f1ee]">{o.name}</h1>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-ink-2">
                  {o.sector && <span>{o.sector}</span>}
                  {o.country && <span>{o.country}</span>}
                  {o.website && (
                    <a href={o.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
                      <Globe className="size-3.5" /> {o.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </p>
              </div>
            </div>
          ) : q.isPending ? (
            <div className="mt-8 flex items-center gap-6">
              <Skeleton className="size-[88px] rounded-[30%]" />
              <Skeleton className="h-12 w-72" />
            </div>
          ) : (
            <div className="mt-8">
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            </div>
          )}
          {o?.description && <p className="mt-8 max-w-[64ch] text-[16px] leading-relaxed text-ink-2">{o.description}</p>}
        </Container>
      </section>
      {o && (
        <Container className="pb-24">
          <h2 className="mb-5 font-display text-[20px] font-light tracking-[-0.02em] text-ink">Pools</h2>
          {o.pools.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {o.pools.map((p) => (
                <PoolCard key={p.id} pool={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Layers />}
              title={`${o.name} has no public pools yet`}
              body="Pools appear here once they start raising capital."
              action={
                <ButtonLink href="/pools" size="sm">
                  Browse all pools
                </ButtonLink>
              }
            />
          )}
        </Container>
      )}
    </>
  );
}
