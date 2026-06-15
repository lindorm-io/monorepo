import type { TokenProfile } from "../../../types/index.js";

/**
 * Erasure token — `erasure+jwt` (E9; SET shape, webhook channel). REQUIRED:
 * iss, aud, iat, exp, jti, sub, events (`urn:lindorm:event:rtbf`); `nonce`
 * MUST NOT be present. Not encryptable. SET-shaped (RFC 8417 permits any JWS
 * alg), so `confidential` for parity with security_event: `HS*` permitted,
 * `none` rejected. (lindorm-internal — no external RFC governs the alg.)
 */
export const erasureTokenProfile: TokenProfile = {
  name: "erasure_token",
  typ: "erasure+jwt",
  required: [
    "issuer",
    "audience",
    "issuedAt",
    "expiresAt",
    "tokenId",
    "subject",
    "events",
  ],
  forbidden: ["nonce"],
  requiredWhen: [],
  atLeastOneOf: [],
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
