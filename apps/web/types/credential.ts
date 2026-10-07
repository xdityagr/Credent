export type CredentialType =
  | "BUSINESS_CREDIT"
  | "UNIVERSITY_ENROLLMENT";

export interface CredentialSubject {
  id: string;
}

export interface BusinessCreditClaims {
  annualRevenue: number;
  creditScore: number;
  totalDebt: number;
  businessAgeYears: number;
  latePayments: number;
}

export interface UniversityCredentialClaims {
  university: string;
  enrollmentStatus: "ACTIVE" | "INACTIVE";
}

export interface VerifiableCredential<TClaims> {
  id: string;
  type: CredentialType;
  issuer: string;
  subject: CredentialSubject;
  claims: TClaims;
  issuedAt: string;
  expiresAt?: string;
  commitment?: string;
}

/**
 * Public representation of a business financial credential.
 *
 * The actual financial values remain private.
 * A verifier only receives the claim being proven.
 */
export interface BusinessCreditProofCredential {
  id: string;
  type: "BUSINESS_CREDIT";
  issuer: string;
  subject: CredentialSubject;

  claim: {
    type:
      | "MIN_REVENUE"
      | "MIN_CREDIT_SCORE"
      | "MAX_DEBT"
      | "MIN_BUSINESS_AGE"
      | "MAX_LATE_PAYMENTS";
    threshold: number;
  };

  proof: {
    proof: string;
    publicInputs: string;
    verificationKey: string;
  };

  issuedAt: string;
  expiresAt?: string;
}