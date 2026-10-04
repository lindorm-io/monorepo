import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Erasure token — `erasure+jwt`, a Security Event Token delivered over a webhook
 * channel (RFC 8417). Not encryptable.
 *
 * ⚠ `algClass: "asymmetric"` is aegis policy, on mint and verify alike: no
 * external specification governs the alg here. Verify stays strict because a
 * shared MAC secret both verifies AND forges, so anyone holding it could forge an
 * instruction to erase. It sits in the signing floor, so an asymmetric key is
 * SELECTED rather than an HS-signed token minted and caught afterwards.
 * pinned: Aegis.signature-proof.feature
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
  algClass: "asymmetric",
});
