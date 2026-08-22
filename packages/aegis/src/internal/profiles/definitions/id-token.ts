import { isClaimOmitted } from "../../utils/rules/index.js";
import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * ID token — bare `JWT` typ (OIDC Core §2). Encryptable; confidential-client `HS*`
 * permitted. ⚠ `at_hash` is REQUIRED whenever an access token co-issues, which is
 * STRICTER than OIDC Core §3.1.3.6.
 *
 * ⚠ That is the profile's only context-reading rule, so minting an id_token
 * REQUIRES the caller to state `accessTokenIssued` — as `false` when no access
 * token co-issues. aegis can infer nothing: a token with no `at_hash` and a caller
 * who forgot to mention the access token look identical from here, and the second
 * is the one that must not mint.
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
      when: (claims, context) => {
        // An access token co-issued: the hash is owed, full stop.
        if (context.accessTokenIssued === true) return true;

        // `requiredWhen` only reaches this predicate when `accessTokenHash` is
        // EMPTY, so a claim the caller OMITTED is the honest "no access token,
        // therefore no hash" and nothing is owed.
        if (isClaimOmitted(claims.accessTokenHash)) return false;

        // What is left is a caller who NAMED `at_hash` and gave it nothing
        // (`""`, `null`). Having stated the claim, they owe a real hash.
        return true;
      },
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
