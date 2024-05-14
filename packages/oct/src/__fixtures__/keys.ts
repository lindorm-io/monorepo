import { Kryptos, KryptosFromB64 } from "@lindorm/kryptos";

const defaults = {
  notBefore: new Date("2023-01-01T01:00:00.000Z"),
  updatedAt: new Date("2024-01-01T01:00:00.000Z"),
  expiresAt: new Date("2024-03-01T00:00:00.000Z"),
  issuer: "https://test.lindorm.io/",
  jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
};

const OCT: KryptosFromB64 = {
  ...defaults,
  id: "c124f42f-5a61-582d-9fdd-b834de3336a2",
  createdAt: new Date("2023-01-01T00:10:00.000Z"),
  privateKey: "NjVhNF9EK0BTUWJAd0AwUU9IQWkmdTgwWEo2QDJmYjI",
  type: "oct",
};

export const TEST_OCT_KEY = Kryptos.from("b64", {
  ...OCT,
  algorithm: "HS256",
  operations: ["sign", "verify"],
  use: "sig",
});
