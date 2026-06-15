import type { TokenProfile } from "../../../types/index.js";

/**
 * Delegation designation — `delegation+jwt` (ADR-0025; console-signed). The
 * issuer is the requesting client's `client_id`, so `issuer: "per-token"`
 * (carried on content, not the platform issuer). REQUIRED: iss, sub, aud, exp,
 * jti (single-use); iat RECOMMENDED. Asymmetric (the client's registered
 * keys); not encryptable.
 */
export const delegationProfile: TokenProfile = {
  name: "delegation",
  typ: "application/delegation+jwt",
  required: ["issuer", "subject", "audience", "expiresAt", "tokenId"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: false, iss: false },
  issuer: "per-token",
  lifetime: "2m",
  encryptable: false,
  algClass: "asymmetric",
  rules: {
    issUri: false,
    crossField: true,
  },
  validate: () => [],
};
