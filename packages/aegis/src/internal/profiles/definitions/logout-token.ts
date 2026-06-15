import type { TokenProfile } from "../../../types/index.js";

/**
 * Logout token — `logout+jwt` (Back-Channel Logout §2.4; SET-shaped).
 * REQUIRED: iss, aud, iat, exp, jti, events; at least one of sub/sid (we send
 * both); `nonce` MUST NOT be present. Not encryptable. Signed like an ID Token
 * (Back-Channel Logout §2.6: alg governed exactly as for ID Tokens, default
 * RS256, only `none` forbidden) — so `confidential`: `HS*` is permitted (a
 * confidential client's secret is the MAC key), `none` rejected.
 */
export const logoutTokenProfile: TokenProfile = {
  name: "logout_token",
  typ: "logout+jwt",
  required: ["issuer", "audience", "issuedAt", "expiresAt", "tokenId", "events"],
  forbidden: ["nonce"],
  requiredWhen: [],
  atLeastOneOf: [["subject", "sessionId"]],
  autoInject: { iat: true, jti: true, nbf: false, iss: true },
  issuer: "platform",
  lifetime: "2m",
  encryptable: false,
  algClass: "confidential",
  rules: {
    issUri: true,
    crossField: true,
    eventsShape: true,
  },
  validate: () => [],
};
