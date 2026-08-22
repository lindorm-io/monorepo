import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Erasure token — `erasure+jwt`, a Security Event Token delivered over a webhook
 * channel (RFC 8417). Not encryptable.
 *
 * ⚠ `confidential` is lindorm's own choice, for parity with `security_event`: no
 * external specification governs the alg here.
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
