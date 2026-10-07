/**
 * Generates a cryptographically secure random nonce.
 *
 * The nonce is kept private and is used together with
 * the financial value when creating a commitment.
 */

export function generateNonce(length = 32): string {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}