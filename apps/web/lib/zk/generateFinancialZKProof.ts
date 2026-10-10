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
 * Calls the local proof API.
 *
 * The current prover requires Windows PowerShell and WSL.
 * It is not available in the Vercel deployment.
 */
export async function generateFinancialZKProof(
  _input: GenerateFinancialZKProofInput
): Promise<GenerateFinancialZKProofResult> {
  throw new Error(
    "Online proof generation is not available yet. " +
      "The current Noir/Barretenberg prover runs locally using Windows and WSL."
  );
}