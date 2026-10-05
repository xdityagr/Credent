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

  /**
   * Cryptographic commitment to the private claims.
   *
   * The underlying financial data should not be
   * published on-chain.
   */
  commitment?: string;
}