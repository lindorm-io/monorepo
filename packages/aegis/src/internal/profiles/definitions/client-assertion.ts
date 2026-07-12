import type { TokenProfile } from "../../../types/index.js";

/**
 * Client authentication assertion (RFC 7523 / OIDC Core §9). RFC 7523 does
 * not require a typ header on client assertions and stock OAuth libraries
 * omit it, so typ presence is `optional`: an absent typ is accepted, a
 * present typ must be exactly `JWT`. `iss` = `sub` = the `client_id`, so
 * `issuer: "per-token"`. REQUIRED: iss, sub, aud, exp, jti (single-use); iat
 * RECOMMENDED. Asymmetric or confidential-client `HS*` (`client_secret_jwt`);
 * not encryptable.
 */
export const clientAssertionProfile: TokenProfile = {
  name: "client_assertion",
  typ: { presence: "optional", value: "JWT" },
  required: ["issuer", "subject", "audience", "expiresAt", "tokenId"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: false, iss: false },
  issuer: "per-token",
  lifetime: "2m",
  encryptable: false,
  algClass: "confidential",
  rules: {
    crossField: true,
  },
  validate: () => [],
};
