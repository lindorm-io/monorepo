import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * JARM response JWT (JWT Secured Authorization Response Mode, §2.1) — no `typ`
 * mandated. §2.1: *"iss - the issuer URL of the authorization server that created
 * the response […] aud - the client_id of the client the response is intended for
 * […] exp - expiration of the JWT. A maximum JWT lifetime of 10 minutes is
 * RECOMMENDED."* — and the JWT "MUST furthermore contain the authorization
 * endpoint response parameters as defined for the particular response types".
 * Signed always (`none` forbidden); confidential-client `HS*` permitted;
 * encryptable.
 *
 * https://openid.net/specs/oauth-v2-jarm.html
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
