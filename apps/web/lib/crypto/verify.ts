import { createCommitment } from "./commitment";

export interface FinancialProof {
  claim: string;
  value: number;
  nonce: string;
  commitment: string;
}

export async function verifyFinancialProof(
  proof: FinancialProof
): Promise<boolean> {
  const regeneratedCommitment = await createCommitment(
    String(proof.value),
    proof.nonce
  );

  return regeneratedCommitment === proof.commitment;
}