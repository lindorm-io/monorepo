import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Signed UserInfo response JWT (OIDC Core §5.3.2 — no `typ` mandated).
 * REQUIRED: iss, sub, aud. Server-signed; confidential-client `HS*` permitted
 * (§5); encryptable (T5).
 */
export const userinfoProfile = defineProfile({
  name: "userinfo",
  typ: { presence: "none" },
  required: ["issuer", "subject", "audience"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: ["issuer"],
  issuer: "platform",
  lifetime: null,
  encryptable: true,
  rules: ISSUER_IS_URI,
  validate: () => [],
});
