import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * CAEP / Shared Signals event — `secevent+jwt` (RFC 8417 under SSF 1.0's SET
 * profile). REQUIRED: iss, aud, iat, jti, sub_id (RFC 9493), events; `sub`,
 * `exp`, and `nonce` MUST NOT be present (SSF prohibitions + SET/ID-token
 * anti-confusion). `lifetime: null` ⇒ no `exp`. Server-signed; neither RFC 8417
 * nor SSF mandates asymmetric — SSF §4.1.1's own example header is
 * `{"typ":"secevent+jwt","alg":"HS256"}` — so `confidential`: `HS*` permitted,
 * `none` rejected.
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
