import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Signed UserInfo response JWT — OIDC Core §5.3.2, which mandates no `typ`.
 * Server-signed; confidential-client `HS*` permitted; encryptable.
 */
export const userinfoProfile = defineProfile({
  name: "userinfo",
  typ: { presence: "none" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "subject", "audience"],
    },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
  ],
  autoInject: ["issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: true,
});
