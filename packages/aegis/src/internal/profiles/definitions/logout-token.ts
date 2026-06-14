import type { TokenProfile } from "../../../types/index.js";

/**
 * Logout token — `logout+jwt` (Back-Channel Logout §2.4; SET-shaped).
 * REQUIRED: iss, aud, iat, exp, jti, events; at least one of sub/sid (we send
 * both); `nonce` MUST NOT be present. Server-signed asymmetric, not
 * encryptable.
 */
export const logoutTokenProfile: TokenProfile = {
  name: "logout_token",
  typ: "logout+jwt",
  required: ["iss", "aud", "iat", "exp", "jti", "events"],
  forbidden: ["nonce"],
  requiredWhen: [],
  atLeastOneOf: [["sub", "sid"]],
  autoInject: { iat: true, jti: true, nbf: false, iss: true },
  issuer: "platform",
  lifetime: "2m",
  encryptable: false,
  algClass: "asymmetric",
  rules: {
    issUri: true,
    crossField: true,
    eventsShape: true,
  },
  validate: () => [],
};
