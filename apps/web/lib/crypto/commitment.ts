/**
 * Cryptographic commitment utilities.
 *
 * The important principle here is:
 *
 * private value
 *      ↓
 * cryptographic hash
 *      ↓
 * commitment
 *
 * The commitment can be stored or published without revealing
 * the original value.
 */

export async function createCommitment(
  value: string,
  nonce: string
): Promise<string> {
  const encoder = new TextEncoder();

  const data = encoder.encode(`${value}:${nonce}`);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}