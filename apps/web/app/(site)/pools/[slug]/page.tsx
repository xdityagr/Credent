import { PoolDetail } from "./pool-detail";

export default async function PoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PoolDetail slug={slug} />;
}
