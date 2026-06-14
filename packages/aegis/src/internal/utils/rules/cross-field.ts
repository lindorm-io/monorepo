import { isFinite } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * Cross-field temporal coherence on the envelope timestamps. Only checks
 * pairs that are both present (presence is handled by require/forbid rules):
 *
 *   - `exp` must be strictly greater than `iat`,
 *   - `nbf` must be less than or equal to `exp`,
 *   - `nbf` must be less than or equal to `exp` when `iat` absent too.
 *
 * Timestamps are Unix seconds.
 */
export const crossField = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  const exp = claims.exp;
  const iat = claims.iat;
  const nbf = claims.nbf;

  if (isFinite(exp) && isFinite(iat) && exp <= iat) {
    invalid.push({ key: "exp", message: "exp must be greater than iat" });
  }

  if (isFinite(nbf) && isFinite(exp) && nbf > exp) {
    invalid.push({ key: "nbf", message: "nbf must be less than or equal to exp" });
  }

  return invalid;
};
