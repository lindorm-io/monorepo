import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Introspection response JWT — `token-introspection+jwt` (RFC 9701 §5).
 * Server-signed; confidential-client `HS*` permitted; encryptable.
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
