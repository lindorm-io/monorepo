import type { TokenProfile } from "../../../types/index.js";

/**
 * Erasure token — `erasure+jwt` (E9; SET shape, webhook channel). REQUIRED:
 * iss, aud, iat, exp, jti, sub, events (`urn:lindorm:event:rtbf`); `nonce`
 * MUST NOT be present. Server-signed asymmetric, not encryptable.
 */
export const erasureTokenProfile: TokenProfile = {
  name: "erasure_token",
  typ: "erasure+jwt",
  required: ["iss", "aud", "iat", "exp", "jti", "sub", "events"],
  forbidden: ["nonce"],
  requiredWhen: [],
  atLeastOneOf: [],
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
