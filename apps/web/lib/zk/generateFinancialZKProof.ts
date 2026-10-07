export interface GenerateFinancialZKProofInput {
  revenue: number;
  threshold: number;
}

export interface GenerateFinancialZKProofResult {
  valid: boolean;
  claim: "MIN_REVENUE";
  threshold: number;
  proof: string;
  publicInputs: string;
  verificationKey: string;
}

/**
 * Calls the Credent ZK proof API and returns the
 * generated Noir + Barretenberg proof artifacts.
 *
 * This function is intended for server-side use.
 */
export async function generateFinancialZKProof(
  input: GenerateFinancialZKProofInput
): Promise<GenerateFinancialZKProofResult> {
  const response = await fetch(
    "http://localhost:3000/api/financial-proof",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revenue: input.revenue,
        threshold: input.threshold,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to generate financial ZK proof."
    );
  }

  if (!data.valid) {
    throw new Error(
      data.message ||
        "Financial data does not satisfy the requested claim."
    );
  }

  if (
    typeof data.proof !== "string" ||
    typeof data.publicInputs !== "string" ||
    typeof data.verificationKey !== "string"
  ) {
    throw new Error(
      "ZK proof response is missing required proof artifacts."
    );
  }

  return {
    valid: data.valid,
    claim: data.claim,
    threshold: data.threshold,
    proof: data.proof,
    publicInputs: data.publicInputs,
    verificationKey: data.verificationKey,
  };
}