import { Kryptos, KryptosFromB64 } from "@lindorm/kryptos";

const defaults = {
  notBefore: new Date("2023-01-01T01:00:00.000Z"),
  updatedAt: new Date("2024-01-01T01:00:00.000Z"),
  expiresAt: new Date("2024-03-01T00:00:00.000Z"),
  issuer: "https://test.lindorm.io/",
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
};

const OKP: KryptosFromB64 = {
  ...defaults,
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
  id: "f1954e7a-dade-55af-9622-c89f65636e3c",
  createdAt: new Date("2023-01-01T00:20:00.000Z"),
};

export const TEST_OKP_KEY = Kryptos.from("b64", {
  ...OKP,
  algorithm: "EdDSA",
  operations: ["sign", "verify"],
  use: "sig",
});
