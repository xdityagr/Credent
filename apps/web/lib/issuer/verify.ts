import {
  createPublicKey,
  verify,
} from "crypto";

import type {
  IssuerSignedFinancialCredential,
} from "./credential";

function getIssuerPublicKey() {
  const publicKey = process.env.CREDENT_ISSUER_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error(
      "CREDENT_ISSUER_PUBLIC_KEY is not configured."
    );
  }

  return createPublicKey({
    key: Buffer.from(publicKey, "base64"),
    format: "der",
    type: "spki",
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

export function verifyFinancialCredential(
  credential: IssuerSignedFinancialCredential
): boolean {
  const { signature, ...credentialWithoutSignature } =
    credential;

  const payload = createSigningPayload(
    credentialWithoutSignature
  );

  return verify(
    null,
    Buffer.from(payload, "utf8"),
    getIssuerPublicKey(),
    Buffer.from(signature, "base64")
  );
}