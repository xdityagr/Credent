import type {
  AgeCredentialClaims,
  VerifiableCredential,
} from "@/types/credential";

export function createMockAgeCredential(
  walletAddress: string
): VerifiableCredential<AgeCredentialClaims> {
  return {
    id: "credent-age-demo-001",

    type: "AGE_VERIFICATION",

    issuer: "did:credent:demo-issuer",

    subject: {
      id: walletAddress,
    },

    claims: {
      dateOfBirth: "2000-01-15",
    },

    issuedAt: "2026-10-01T00:00:00.000Z",

    expiresAt: "2027-10-01T00:00:00.000Z",
  };
}