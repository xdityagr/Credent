import { createCommitment } from "./commitment";
import { generateNonce } from "./nonce";

export type FinancialClaimType =
  | "MIN_REVENUE"
  | "MIN_CREDIT_SCORE"
  | "MAX_DEBT"
  | "MIN_BUSINESS_AGE"
  | "MAX_LATE_PAYMENTS";

export interface FinancialClaim {
  type: FinancialClaimType;
  threshold: number;
}

export interface PrivateFinancialData {
  annualRevenue: number;
  creditScore: number;
  totalDebt: number;
  businessAgeYears: number;
  latePayments: number;
}

export interface FinancialProof {
  claim: FinancialClaim;

  /**
   * Commitment to the private financial value.
   * The actual value is never included in the proof.
   */
  commitment: string;

  /**
   * Indicates whether the private value satisfies
   * the requested financial claim.
   *
   * This is a temporary demo proof.
   * A real ZK proof will replace this later.
   */
  valid: boolean;
}

function getValue(
  data: PrivateFinancialData,
  claimType: FinancialClaimType
): number {
  switch (claimType) {
    case "MIN_REVENUE":
      return data.annualRevenue;

    case "MIN_CREDIT_SCORE":
      return data.creditScore;

    case "MAX_DEBT":
      return data.totalDebt;

    case "MIN_BUSINESS_AGE":
      return data.businessAgeYears;

    case "MAX_LATE_PAYMENTS":
      return data.latePayments;
  }
}

function satisfiesClaim(
  value: number,
  claim: FinancialClaim
): boolean {
  switch (claim.type) {
    case "MIN_REVENUE":
    case "MIN_CREDIT_SCORE":
    case "MIN_BUSINESS_AGE":
      return value >= claim.threshold;

    case "MAX_DEBT":
    case "MAX_LATE_PAYMENTS":
      return value <= claim.threshold;
  }
}

export async function generateFinancialProof(
  data: PrivateFinancialData,
  claim: FinancialClaim
): Promise<FinancialProof> {
  const privateValue = getValue(data, claim.type);

  const valid = satisfiesClaim(privateValue, claim);

  const nonce = generateNonce();

  const commitment = await createCommitment(
    privateValue.toString(),
    nonce
  );

  return {
    claim,
    commitment,
    valid,
  };
}