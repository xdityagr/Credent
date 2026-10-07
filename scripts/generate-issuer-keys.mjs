import {
  generateKeyPairSync,
} from "crypto";

const { privateKey, publicKey } =
  generateKeyPairSync("ed25519", {
    privateKeyEncoding: {
      type: "pkcs8",
      format: "der",
    },
    publicKeyEncoding: {
      type: "spki",
      format: "der",
    },
  });

console.log(
  `CREDENT_ISSUER_PRIVATE_KEY=${privateKey.toString("base64")}`
);

console.log(
  `CREDENT_ISSUER_PUBLIC_KEY=${publicKey.toString("base64")}`
);