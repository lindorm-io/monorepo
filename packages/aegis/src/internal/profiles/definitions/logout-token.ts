import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Logout token — `logout+jwt` (Back-Channel Logout §2.4; SET-shaped).
 * REQUIRED: iss, aud, iat, exp, jti, events; at least one of sub/sid (we send
 * both); `nonce` MUST NOT be present. Not encryptable. Signed like an ID Token
 * (Back-Channel Logout §2.6: alg governed exactly as for ID Tokens, default
 * RS256, only `none` forbidden) — so `confidential`: `HS*` is permitted (a
 * confidential client's secret is the MAC key), `none` rejected.
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
    // Back-Channel Logout §2.4 — a logout token MUST contain sub, sid, or both.
    // It runs on VERIFY too: the requirement is on the token a relying party
    // RECEIVES, and one identifying nothing has nothing to terminate.
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
