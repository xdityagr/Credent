import {
  generateFinancialProof,
  type FinancialClaim,
  type PrivateFinancialData,
} from "./crypto/proof";

import type {
  BusinessCreditClaims,
  VerifiableCredential,
} from "../types/credential";

export interface BusinessCreditCredential
  extends VerifiableCredential<BusinessCreditClaims> {
  type: "BUSINESS_CREDIT";
}

/**
 * Demo private financial data.
 *
 * In the real Credent system this will eventually come
 * from a verified financial data source.
 */
export const privateFinancialData: PrivateFinancialData = {
  annualRevenue: 1347829,
  creditScore: 742,
  totalDebt: 320000,
  businessAgeYears: 6,
  latePayments: 1,
};

/**
 * Creates a demo Business Credit credential.
 *
 * IMPORTANT:
 * The raw financial values are kept locally.
 * The credential exposes only a cryptographic commitment.
 */
export async function createBusinessCreditCredential(
  subjectId: string
): Promise<BusinessCreditCredential> {
  const claims: BusinessCreditClaims = {
    annualRevenue: privateFinancialData.annualRevenue,
    creditScore: privateFinancialData.creditScore,
    totalDebt: privateFinancialData.totalDebt,
    businessAgeYears: privateFinancialData.businessAgeYears,
    latePayments: privateFinancialData.latePayments,
  };

  const claim: FinancialClaim = {
    type: "MIN_REVENUE",
    threshold: 1000000,
  };

  const proof = await generateFinancialProof(
    privateFinancialData,
    claim
  );

  return {
    id: `credent-business-${Date.now()}`,
    type: "BUSINESS_CREDIT",
    issuer: "Credent",
    subject: {
      id: subjectId,
    },
    claims,
    issuedAt: new Date().toISOString(),
    commitment: proof.commitment,
  };
}