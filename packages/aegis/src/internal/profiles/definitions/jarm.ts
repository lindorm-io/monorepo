import type { TokenProfile } from "../../../types/index.js";

/**
 * JARM response JWT (ADR-0016 — no `typ` mandated). REQUIRED: iss, aud
 * (= client_id), exp (≤ 10 min RECOMMENDED) plus the authorization-response
 * parameters as claims. Signed always (`none` forbidden); confidential-client
 * `HS*` permitted (§5); encryptable (T5).
 */
export const jarmProfile: TokenProfile = {
  name: "jarm",
  typ: null,
  required: ["iss", "aud", "exp"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: false, nbf: false, iss: true },
  issuer: "platform",
  lifetime: "10m",
  encryptable: true,
  algClass: "confidential",
  rules: {
    issUri: true,
    crossField: true,
  },
  validate: () => [],
};
