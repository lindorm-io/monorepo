import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * ID token — bare `JWT` typ (OIDC ecosystem convention; OIDC Core §2).
 * REQUIRED: iss, sub, aud (= client_id), exp, iat. `at_hash` is REQUIRED
 * whenever an access token co-issues — OIDC Core §3.1.3.6 makes it OPTIONAL in
 * the code flow; we treat it as required. Encryptable; confidential-client `HS*`
 * permitted.
 *
 * ⚠ The `at_hash` rule is the profile's only context-reading rule, so minting an
 * id_token REQUIRES the caller to state `accessTokenIssued` — as `false` when no
 * access token co-issues. There is no answer aegis can infer: a token with no
 * `at_hash` and a caller who forgot to mention the access token look identical
 * from here, and the second is the one that must not mint.
 */
export const idTokenProfile = defineProfile({
  name: "id_token",
  typ: { presence: "required", value: "JWT" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "subject", "audience", "expiresAt", "issuedAt"],
    },
    {
      rule: "requiredWhen",
      on: ["mint"],
      needs: ["accessTokenIssued"],
      claim: "accessTokenHash",
      when: (claims, context) =>
        context.accessTokenIssued === true || claims.accessTokenHash !== undefined,
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
    { rule: "shape", on: ["mint", "verify"], shape: "confirmation" },
    { rule: "shape", on: ["mint", "verify"], shape: "actChain" },
  ],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: "1h",
  encryptable: true,
});
