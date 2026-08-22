import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Logout token — `logout+jwt`, SET-shaped (OIDC Back-Channel Logout §2.4). Not
 * encryptable. Signed as an ID Token is (OIDC Back-Channel Logout §2.6), so
 * `confidential`: `HS*` permitted, `none` rejected.
 */
export const logoutTokenProfile = defineProfile({
  name: "logout_token",
  typ: { presence: "required", value: "application/logout+jwt" },
  policy: [
    {
      rule: "required",
      on: ["mint", "verify"],
      claims: ["issuer", "audience", "issuedAt", "expiresAt", "tokenId", "events"],
    },
    // OIDC Back-Channel Logout §2.4. It runs on VERIFY too: the requirement is on
    // the token a relying party RECEIVES, and one identifying nothing has nothing
    // to terminate.
    {
      rule: "atLeastOneOf",
      on: ["mint", "verify"],
      claims: ["subject", "sessionId"],
    },
    { rule: "forbidden", on: ["mint", "verify"], claims: ["nonce"] },
    { rule: "match", on: ["mint", "verify"], condition: ISSUER_IS_URI },
    { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
    { rule: "shape", on: ["mint", "verify"], shape: "events" },
  ],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "2m",
  encryptable: false,
});
