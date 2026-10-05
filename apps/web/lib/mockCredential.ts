import type {
  AgeCredentialClaims,
  VerifiableCredential,
} from "@/types/credential";

import { createCommitment } from "@/lib/crypto/commitment";

export async function createMockAgeCredential(
  walletAddress: string
): Promise<VerifiableCredential<AgeCredentialClaims>> {
  const dateOfBirth = "2000-01-15";

  /**
   * In a real credential this nonce would be generated securely
   * when the credential is issued.
   *
   * We keep this deterministic for our current demo so that the
   * credential is stable while developing.
   */
  const nonce = "credent-demo-nonce-001";

  const commitment = await createCommitment(
    dateOfBirth,
    nonce
  );

  return {
    id: "credent-age-demo-001",

    type: "AGE_VERIFICATION",

    issuer: "did:credent:demo-issuer",

    subject: {
      id: walletAddress,
    },

    claims: {
      dateOfBirth,
    },

    issuedAt: "2026-10-01T00:00:00.000Z",

    expiresAt: "2027-10-01T00:00:00.000Z",

    commitment,
  };
}