import type { TokenProfile } from "../../../types/index.js";

/**
 * Introspection response JWT — `token-introspection+jwt` (RFC 9701 §5). Top
 * level REQUIRED: iss, aud (the requesting RS), iat, token_introspection.
 * Server-signed; confidential-client `HS*` permitted (§5); encryptable (T5).
 */
export const introspectionProfile: TokenProfile = {
  name: "introspection",
  typ: "token-introspection+jwt",
  required: ["issuer", "audience", "issuedAt", "token_introspection"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: false, nbf: false, iss: true },
  issuer: "platform",
  lifetime: null,
  encryptable: true,
  algClass: "confidential",
  rules: {
    issUri: true,
  },
  validate: () => [],
};
