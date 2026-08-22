import { defineProfile } from "../define-profile.js";

/**
 * A claims floor the policy-free tier does not impose — `aegis.mint("default",
 * content)` where `aegis.jwt.sign(claims)` imposes nothing.
 *
 * ⚠ The floor is lindorm's own, not an RFC artifact, so presence is its whole
 * policy and it declares no structural rules.
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
