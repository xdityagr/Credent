import { ProofView } from "./proof-view";

export default async function ProofPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProofView id={id} />;
}
