import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * JARM response JWT — JARM §2.1, which mandates no `typ`. Signed always (`none`
 * forbidden); confidential-client `HS*` permitted; encryptable.
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
