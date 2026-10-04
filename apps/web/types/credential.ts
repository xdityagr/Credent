export type CredentialType =
  | "AGE_VERIFICATION"
  | "UNIVERSITY_ENROLLMENT";

export interface CredentialSubject {
  id: string;
}

export interface AgeCredentialClaims {
  dateOfBirth: string;
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
}