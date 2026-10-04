import type { VerifiableCredential, AgeCredentialClaims } from "@/types/credential";

export const mockAgeCredential: VerifiableCredential<AgeCredentialClaims> = {
  id: "credent-age-demo-001",
  type: "AGE_VERIFICATION",

  issuer: "did:credent:demo-issuer",

  subject: {
    id: "wallet:demo-user",
  },

  claims: {
    dateOfBirth: "2000-01-15",
  },

  issuedAt: "2026-10-01T00:00:00.000Z",
  expiresAt: "2027-10-01T00:00:00.000Z",
};