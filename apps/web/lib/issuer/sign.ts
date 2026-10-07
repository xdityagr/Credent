import {
  createPrivateKey,
  sign,
} from "crypto";

import type {
  IssuerSignedFinancialCredential,
  IssuerFinancialClaims,
} from "./credential";

function getIssuerPrivateKey() {
  const privateKey = process.env.CREDENT_ISSUER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "CREDENT_ISSUER_PRIVATE_KEY is not configured."
    );
  }

  return createPrivateKey({
    key: Buffer.from(privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function createSigningPayload(
  credential: Omit<
    IssuerSignedFinancialCredential,
    "signature"
  >
): string {
  return JSON.stringify({
    id: credential.id,
    type: credential.type,
    issuer: credential.issuer,
    subject: credential.subject,
    claims: credential.claims,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt ?? null,
  });
}

export function signFinancialCredential(
  input: {
    id: string;
    subjectId: string;
    claims: IssuerFinancialClaims;
    issuedAt: string;
    expiresAt?: string;
  }
): IssuerSignedFinancialCredential {
  const credentialWithoutSignature = {
    id: input.id,

    type: "BUSINESS_FINANCIAL_CREDENTIAL" as const,

    issuer: {
      id: "did:credent:issuer:demo",
      name: "Credent Demo Financial Issuer",

      // The public key will be added when we configure
      // the issuer environment.
      publicKey:
        process.env.CREDENT_ISSUER_PUBLIC_KEY || "",
    },

    subject: {
      id: input.subjectId,
    },

    claims: input.claims,

    issuedAt: input.issuedAt,

    ...(input.expiresAt
      ? { expiresAt: input.expiresAt }
      : {}),
  };

  const payload = createSigningPayload(
    credentialWithoutSignature
  );

  const signature = sign(
    null,
    Buffer.from(payload, "utf8"),
    getIssuerPrivateKey()
  );

  return {
    ...credentialWithoutSignature,
    signature: signature.toString("base64"),
  };
}