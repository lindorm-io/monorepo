import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * CAEP / Shared Signals event — `secevent+jwt` (RFC 8417, under the SSF 1.0 SET
 * profile), with `sub_id` per RFC 9493. `lifetime: null` ⇒ no `exp`.
 *
 * ⚠ The `forbidden` list is SET/ID-token anti-confusion as well as an SSF
 * prohibition. `confidential` (`HS*` permitted, `none` rejected): neither RFC 8417
 * nor Shared Signals Framework §4.1.1 mandates asymmetric.
 */
export const securityEventProfile = defineProfile({
  name: "security_event",
  typ: { presence: "required", value: "application/secevent+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "audience", "issuedAt", "tokenId", "subjectId", "events"],
    },
    {
      rule: "forbidden",
      on: ["mint", "verify"],
      claims: ["subject", "expiresAt", "nonce"],
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "subjectId" },
    { rule: "shape", on: ["mint", "verify"], shape: "events" },
  ],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: false,
});
