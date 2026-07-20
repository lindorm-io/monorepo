import type { Dict } from "@lindorm/types";
import { crossField, eventsShape } from "../../utils/rules/index.js";
import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * Erasure token — `erasure+jwt` (E9; SET shape, webhook channel). REQUIRED:
 * iss, aud, iat, exp, jti, sub, events (`urn:lindorm:event:rtbf`); `nonce`
 * MUST NOT be present. Not encryptable. SET-shaped (RFC 8417 permits any JWS
 * alg), so `confidential` for parity with security_event: `HS*` permitted,
 * `none` rejected. (lindorm-internal — no external RFC governs the alg.)
 */
export const erasureTokenProfile = defineProfile({
  name: "erasure_token",
  typ: { presence: "required", value: "application/erasure+jwt" },
  required: [
    "issuer",
    "audience",
    "issuedAt",
    "expiresAt",
    "tokenId",
    "subject",
    "events",
  ],
  forbidden: ["nonce"],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: ["issuedAt", "tokenId", "issuer"],
  issuer: "platform",
  lifetime: "2m",
  encryptable: false,
  rules: ISSUER_IS_URI,
  validate: (claims: Dict) => [...crossField(claims), ...eventsShape(claims)],
});
