import type { TokenProfile } from "../../../types/index.js";

/**
 * The `default` profile re-imposes the historical `jwt.sign` floor that T1
 * removed from the policy-free tier: it requires `sub` and `exp`, and
 * auto-injects `iat`/`jti`/`nbf`/`iss`. `aegis.mint("default", content)` is a
 * faithful replacement for the old `aegis.jwt.sign(content)`.
 *
 * `validate` is presence-only for this chunk; deep RFC validators land in T4.
 */
export const defaultProfile: TokenProfile = {
  name: "default",
  typ: null,
  required: ["sub", "exp"],
  forbidden: [],
  requiredWhen: [],
  atLeastOneOf: [],
  autoInject: { iat: true, jti: true, nbf: true, iss: true },
  issuer: "platform",
  lifetime: null,
  encryptable: false,
  validate: () => [],
};
