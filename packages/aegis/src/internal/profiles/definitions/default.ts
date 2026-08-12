import { defineProfile } from "../define-profile.js";

/**
 * The `default` profile re-imposes the historical `jwt.sign` floor that T1
 * removed from the policy-free tier: it requires `sub` and `exp`, and
 * auto-injects `iat`/`jti`/`nbf`/`iss`. `aegis.mint("default", content)` is a
 * faithful replacement for the old `aegis.jwt.sign(content)`.
 *
 * Presence is its whole policy — it is the policy-free tier's floor, not an RFC
 * artifact, so it declares no structural rules.
 */
export const defaultProfile = defineProfile({
  name: "default",
  typ: { presence: "none" },
  policy: [
    { rule: "required", on: ["mint", "verify"], claims: ["subject", "expiresAt"] },
  ],
  autoInject: ["issuedAt", "tokenId", "notBefore", "issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: false,
});
