import type { TokenProfile } from "../../../types/index.js";

/**
 * CAEP / Shared Signals event — `secevent+jwt` (RFC 8417 under SSF 1.0's SET
 * profile). REQUIRED: iss, aud, iat, jti, sub_id (RFC 9493), events; `sub`,
 * `exp`, and `nonce` MUST NOT be present (SSF prohibitions + SET/ID-token
 * anti-confusion). `lifetime: null` ⇒ no `exp`. Server-signed; neither RFC 8417
 * nor SSF mandates asymmetric — SSF §4.1.1's own example header is
 * `{"typ":"secevent+jwt","alg":"HS256"}` — so `confidential`: `HS*` permitted,
 * `none` rejected.
 */
export const securityEventProfile: TokenProfile = {
  name: "security_event",
  typ: "application/secevent+jwt",
  required: ["issuer", "audience", "issuedAt", "tokenId", "subjectId", "events"],
  forbidden: ["subject", "expiresAt", "nonce"],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: false, iss: true },
  issuer: "platform",
  lifetime: null,
  encryptable: false,
  algClass: "confidential",
  rules: {
    issUri: true,
    subIdShape: true,
    eventsShape: true,
  },
  validate: () => [],
};
