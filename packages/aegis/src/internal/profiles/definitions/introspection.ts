import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Introspection response JWT — `token-introspection+jwt` (RFC 9701 §5). Top
 * level REQUIRED: iss, aud (the requesting RS), iat, token_introspection.
 * Server-signed; confidential-client `HS*` permitted (§5); encryptable (T5).
 */
export const introspectionProfile = defineProfile({
  name: "introspection",
  typ: { presence: "required", value: "application/token-introspection+jwt" },
  required: ["issuer", "audience", "issuedAt", "token_introspection"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: true,
  rules: ISSUER_IS_URI,
  validate: () => [],
});
