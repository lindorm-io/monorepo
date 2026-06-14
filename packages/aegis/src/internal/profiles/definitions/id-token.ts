import type { Dict } from "@lindorm/types";
import type { SignContext, TokenProfile } from "../../../types/index.js";

/**
 * ID token — bare `JWT` typ (OIDC ecosystem convention; OIDC Core §2).
 * REQUIRED: iss, sub, aud (= client_id), exp, iat. `at_hash` is REQUIRED
 * whenever an access token co-issues (ctx.accessTokenIssued) — OIDC makes it
 * OPTIONAL in the code flow; we treat it as required. Encryptable (T5);
 * confidential-client `HS*` permitted (§5).
 */
export const idTokenProfile: TokenProfile = {
  name: "id_token",
  typ: "JWT",
  required: ["iss", "sub", "aud", "exp", "iat"],
  forbidden: [],
  requiredWhen: [
    {
      claim: "at_hash",
      when: (claims: Dict, ctx: SignContext) =>
        ctx.accessTokenIssued === true || claims.at_hash !== undefined,
    },
  ],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: false, nbf: false, iss: true },
  issuer: "platform",
  lifetime: "1h",
  encryptable: true,
  algClass: "confidential",
  rules: {
    issUri: true,
    crossField: true,
    cnfShape: true,
    actChainShape: true,
  },
  validate: () => [],
};
