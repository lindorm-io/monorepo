import { isDate } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * Cross-field temporal coherence on the envelope timestamps. Only checks
 * pairs that are both present (presence is handled by require/forbid rules):
 *
 *   - `expiresAt` must be strictly after `issuedAt`,
 *   - `notBefore` must be at or before `expiresAt`.
 *
 * The common layer is DOMAIN-keyed, so these are `Date`s (`expiresAt`/
 * `issuedAt`/`notBefore`), not Unix-seconds numbers — compared chronologically.
 */
export const crossField = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  const exp = claims.expiresAt;
  const iat = claims.issuedAt;
  const nbf = claims.notBefore;

  if (isDate(exp) && isDate(iat) && exp.getTime() <= iat.getTime()) {
    invalid.push({
      key: "expiresAt",
      message: "expiresAt (exp) must be after issuedAt (iat)",
    });
  }

  if (isDate(nbf) && isDate(exp) && nbf.getTime() > exp.getTime()) {
    invalid.push({
      key: "notBefore",
      message: "notBefore (nbf) must be at or before expiresAt (exp)",
    });
  }

  return invalid;
};
