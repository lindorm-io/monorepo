import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * JARM response JWT (ADR-0016 — no `typ` mandated). REQUIRED: iss, aud
 * (= client_id), exp (≤ 10 min RECOMMENDED) plus the authorization-response
 * parameters as claims. Signed always (`none` forbidden); confidential-client
 * `HS*` permitted; encryptable.
 */
export const jarmProfile = defineProfile({
  name: "jarm",
  typ: { presence: "none" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "audience", "expiresAt"],
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
  ],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: "10m",
  encryptable: true,
});
