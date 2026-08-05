import { isAfter, isBeforeOrEqual } from "@lindorm/date";
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

  if (isDate(exp) && isDate(iat) && isBeforeOrEqual(exp, iat)) {
    invalid.push({
      key: "expiresAt",
      message: "expiresAt (exp) must be after issuedAt (iat)",
    });
  }

  // `nbf` is allowed to land exactly ON `exp` — RFC 7519 §4.1.5 admits a token
  // usable at `nbf`, so only a STRICTLY later `nbf` is incoherent. Not
  // `isExpired`/`isLive`: those are `exp`-vs-now predicates with the opposite
  // equality boundary, and using one here would reject a legal envelope.
  if (isDate(nbf) && isDate(exp) && isAfter(nbf, exp)) {
    invalid.push({
      key: "notBefore",
      message: "notBefore (nbf) must be at or before expiresAt (exp)",
    });
  }

  return invalid;
};
