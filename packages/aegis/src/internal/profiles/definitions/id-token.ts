import type { Dict } from "@lindorm/types";
import type { SignContext } from "../../../types/index.js";
import { actChainShape, cnfShape, crossField } from "../../utils/rules/index.js";
import { defineProfile } from "../define-profile.js";
import { ISSUER_IS_URI } from "./rule-predicates.js";

/**
 * ID token — bare `JWT` typ (OIDC ecosystem convention; OIDC Core §2).
 * REQUIRED: iss, sub, aud (= client_id), exp, iat. `at_hash` is REQUIRED
 * whenever an access token co-issues (ctx.accessTokenIssued) — OIDC makes it
 * OPTIONAL in the code flow; we treat it as required. Encryptable (T5);
 * confidential-client `HS*` permitted (§5).
 */
export const idTokenProfile = defineProfile({
  name: "id_token",
  typ: { presence: "required", value: "JWT" },
  required: ["issuer", "subject", "audience", "expiresAt", "issuedAt"],
  forbidden: [],
  requiredWhen: [
    {
      claim: "accessTokenHash",
      when: (claims: Dict, ctx: SignContext) =>
        ctx.accessTokenIssued === true || claims.accessTokenHash !== undefined,
    },
  ],
  atLeastOneOf: [],
  autoInject: ["issuedAt", "issuer"],
  issuer: "platform",
  lifetime: "1h",
  encryptable: true,
  rules: ISSUER_IS_URI,
  validate: (claims: Dict) => [
    ...crossField(claims),
    ...cnfShape(claims),
    ...actChainShape(claims),
  ],
});
