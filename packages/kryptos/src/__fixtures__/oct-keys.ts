import { KryptosB64, KryptosJwk, KryptosPem } from "../types";

export const TEST_OCT_KEY_B64: KryptosB64 = {
  privateKey: "NjVhNF9EK0BTUWJAd0AwUU9IQWkmdTgwWEo2QDJmYjI",
  type: "oct",
};

export const TEST_OCT_KEY_JWK: KryptosJwk = {
  k: "QG56NklAWXZwU3hLSXdHe3JbfUBMQDMsXzhobT1OYm0",
  kty: "oct",
};

export const TEST_OCT_KEY_PEM: KryptosPem = {
  privateKey: "&{LefR8dw0@~~gv=@55eR$whPE@C+Ym@",
  type: "oct",
};
