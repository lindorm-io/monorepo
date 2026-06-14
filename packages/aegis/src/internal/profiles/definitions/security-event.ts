import type { TokenProfile } from "../../../types/index.js";

/**
 * CAEP / Shared Signals event — `secevent+jwt` (RFC 8417 under SSF 1.0's SET
 * profile). REQUIRED: iss, aud, iat, jti, sub_id (RFC 9493), events; `sub`,
 * `exp`, and `nonce` MUST NOT be present (SSF prohibitions + SET/ID-token
 * anti-confusion). `lifetime: null` ⇒ no `exp`. Server-signed asymmetric.
 */
export const securityEventProfile: TokenProfile = {
  name: "security_event",
  typ: "secevent+jwt",
  required: ["iss", "aud", "iat", "jti", "sub_id", "events"],
  forbidden: ["sub", "exp", "nonce"],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: false, iss: true },
  issuer: "platform",
  lifetime: null,
  encryptable: false,
  algClass: "asymmetric",
  rules: {
    issUri: true,
    subIdShape: true,
    eventsShape: true,
  },
  validate: () => [],
};
