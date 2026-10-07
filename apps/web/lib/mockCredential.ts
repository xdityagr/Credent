import { privateFinancialData } from "./mockCredentialData";

import { generateFinancialZKProof } from "./zk/generateFinancialZKProof";

import { signFinancialCredential } from "./issuer/sign";

import { verifyFinancialCredential } from "./issuer/verify";

import type {
  BusinessCreditProofCredential,
} from "../types/credential";

import type {
  IssuerSignedFinancialCredential,
} from "./issuer/credential";
export async function createBusinessCreditProofCredential(
  subjectId: string
): Promise<BusinessCreditProofCredential> {
  const threshold = 1_000_000;

  /*
   * Step 1:
   * Create the issuer-signed financial credential.
   *
   * The raw financial claims stay server-side.
   */
  const issuerCredential: IssuerSignedFinancialCredential =
    signFinancialCredential({
      id: `credent-financial-${Date.now()}`,

      subjectId,

      claims: privateFinancialData,

      issuedAt: new Date().toISOString(),
    });

    const issuerSignatureValid =
  verifyFinancialCredential(issuerCredential);

if (!issuerSignatureValid) {
  throw new Error(
    "Issuer signature verification failed."
  );
}
  /*
   * Step 2:
   * Generate the ZK proof from the private financial value.
   *
   * The proof demonstrates:
   *
   * annualRevenue >= threshold
   */
  const proof = await generateFinancialZKProof({
    revenue: issuerCredential.claims.annualRevenue,
    threshold,
  });

  /*
   * Step 3:
   * Return only the public proof credential.
   *
   * Raw financial claims and the issuer signature are
   * deliberately NOT included here.
   */
  return {
    id: `credent-business-proof-${Date.now()}`,

    type: "BUSINESS_CREDIT",

    issuer: issuerCredential.issuer.id,

    subject: {
      id: subjectId,
    },

    claim: {
      type: proof.claim,
      threshold: proof.threshold,
    },

    proof: {
      proof: proof.proof,
      publicInputs: proof.publicInputs,
      verificationKey: proof.verificationKey,
    },

    issuedAt: issuerCredential.issuedAt,

    ...(issuerCredential.expiresAt
      ? {
          expiresAt: issuerCredential.expiresAt,
        }
      : {}),
  };
}