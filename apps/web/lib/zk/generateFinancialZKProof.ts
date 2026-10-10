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
 * Calls the local Noir + Barretenberg proof API.
 *
 * This implementation is for local development only.
 * It requires the Next.js server to be running on localhost:3000,
 * with Windows PowerShell, WSL, Nargo, and Barretenberg installed.
 *
 * Do not deploy this local-only implementation as the production
 * prover. Vercel cannot execute the Windows/WSL prover script.
 */
export async function generateFinancialZKProof(
  input: GenerateFinancialZKProofInput
): Promise<GenerateFinancialZKProofResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Online proof generation is unavailable. " +
        "The current prover requires Windows PowerShell and WSL."
    );
  }

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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Financial proof API failed (HTTP ${response.status}).`
    );
  }

  if (!data?.valid) {
    throw new Error(
      data?.message ||
        data?.error ||
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