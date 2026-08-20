import { defineProfile } from "../define-profile.js";

/**
 * The `default` profile imposes a claims floor the policy-free tier does not: it
 * requires `sub` and `exp`, and auto-injects `iat`/`jti`/`nbf`/`iss`. It is what a
 * caller reaches for when it wants those guarantees without picking a
 * specification-defined profile — `aegis.mint("default", content)` where
 * `aegis.jwt.sign(claims)` would impose nothing.
 *
 * Presence is its whole policy — the floor is lindorm's own, not an RFC artifact,
 * so it declares no structural rules.
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
