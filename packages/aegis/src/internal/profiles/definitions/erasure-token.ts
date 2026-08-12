import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Erasure token — `erasure+jwt` (E9; SET shape, webhook channel). REQUIRED:
 * iss, aud, iat, exp, jti, sub, events (`urn:lindorm:event:rtbf`); `nonce`
 * MUST NOT be present. Not encryptable. SET-shaped (RFC 8417 permits any JWS
 * alg), so `confidential` for parity with security_event: `HS*` permitted,
 * `none` rejected. (lindorm-internal — no external RFC governs the alg.)
 */
export const erasureTokenProfile = defineProfile({
  name: "erasure_token",
  typ: { presence: "required", value: "application/erasure+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: [
        "issuer",
        "audience",
        "issuedAt",
        "expiresAt",
        "tokenId",
        "subject",
        "events",
      ],
    },
    { rule: "forbidden", on: ["mint", "verify"], claims: ["nonce"] },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
    { rule: "shape", on: ["mint", "verify"], shape: "events" },
  ],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "2m",
  encryptable: false,
});
