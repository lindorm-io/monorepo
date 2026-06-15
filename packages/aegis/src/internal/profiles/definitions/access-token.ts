import type { TokenProfile } from "../../../types/index.js";

/**
 * Access token — `at+jwt` (RFC 9068 §2.2). Server-signed, asymmetric only
 * (§5: never `HS*`/`none`), never encryptable. `aud` resolves to exactly one
 * resource URI (ADR-0014). REQUIRED: iss, exp, aud, sub, client_id, iat, jti.
 */
export const accessTokenProfile: TokenProfile = {
  name: "access_token",
  typ: "at+jwt",
  required: [
    "issuer",
    "expiresAt",
    "audience",
    "subject",
    "clientId",
    "issuedAt",
    "tokenId",
  ],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: false, iss: true },
  issuer: "platform",
  lifetime: "1h",
  encryptable: false,
  algClass: "asymmetric",
  rules: {
    issUri: true,
    crossField: true,
    audSingleResource: true,
    authorizationDetailsType: true,
    cnfShape: true,
    actChainShape: true,
  },
  validate: () => [],
};
