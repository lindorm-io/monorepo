import { defineProfile } from "../define-profile.js";

/**
 * Delegation designation — `delegation+jwt` (ADR-0025; console-signed). The
 * issuer is the requesting client's `client_id`, so `issuer: "per-token"`
 * (carried on content, not the platform issuer). REQUIRED: iss, sub, aud, exp,
 * jti (single-use); iat RECOMMENDED. Asymmetric (the client's registered
 * keys); not encryptable.
 */
export const delegationProfile = defineProfile({
  name: "delegation",
  typ: { presence: "required", value: "application/delegation+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "subject", "audience", "expiresAt", "tokenId"],
    },
    // No ISSUER_IS_URI: the delegation issuer is the requesting client's
    // `client_id` (per-token), NOT a URL.
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
  ],
  autoInject: ["issuedAt", "tokenId"],
  issuer: "per-token",
  lifetime: "2m",
  encryptable: false,
  algClass: "asymmetric",
});
