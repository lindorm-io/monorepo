import type { Dict } from "@lindorm/types";
import { crossField } from "../../utils/rules/index.js";
import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * JARM response JWT (ADR-0016 — no `typ` mandated). REQUIRED: iss, aud
 * (= client_id), exp (≤ 10 min RECOMMENDED) plus the authorization-response
 * parameters as claims. Signed always (`none` forbidden); confidential-client
 * `HS*` permitted (§5); encryptable (T5).
 */
export const jarmProfile = defineProfile({
  name: "jarm",
  typ: { presence: "none" },
  required: ["issuer", "audience", "expiresAt"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: "10m",
  encryptable: true,
  rules: ISSUER_IS_URI,
  validate: (claims: Dict) => crossField(claims),
});
