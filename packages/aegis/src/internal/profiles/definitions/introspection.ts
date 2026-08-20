import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Introspection response JWT — `token-introspection+jwt` (RFC 9701 §5). Top
 * level REQUIRED: iss, aud (the requesting RS), iat, token_introspection.
 * Server-signed; confidential-client `HS*` permitted (RFC 9701 §5); encryptable.
 */
export const introspectionProfile = defineProfile({
  name: "introspection",
  typ: { presence: "required", value: "application/token-introspection+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "audience", "issuedAt", "token_introspection"],
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
  ],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: true,
});
