import { isString } from "@lindorm/is";
import { headerByJose } from "./header-registry.js";

/**
 * May a PRODUCER mark this `crit` MEMBER critical? The ONE expression of
 * {@link HeaderSpec.critEligible}, and the registry half of the WRITE gate's rule
 * (`internal/header/assert-crit-eligible.ts`; the other half is a custom parameter
 * the same call writes).
 *
 * ⛔ WRITE-SIDE ONLY — THIS COLUMN, not the registry. The read gate reads the
 * registry too, but only ever to REFUSE, and never admits a member on the strength
 * of a cell: acceptance there needs the CALLER's declaration, which is necessary
 * and not sufficient (`internal/utils/reject-unknown-critical.ts`). That aegis
 * registers a parameter says nothing about whether the application behind aegis can
 * act on one, and the duty is the RECIPIENT's (RFC 7515 §4.1.11).
 *
 * ⚠ It is deliberately NOT "is this parameter registered". The two questions agree
 * for every name the registry holds today and part company the moment a SECOND
 * proprietary parameter is registered that must not be markable critical — at which
 * point a column makes that a one-word decision. Pinned in
 * `is-crit-eligible.test.ts`.
 *
 * ⚠ An UNREGISTERED name answers `false`, which is not the write gate's final
 * verdict: `assert-crit-eligible.ts` admits it when the same call writes it as a
 * CUSTOM parameter. Widening this to "not registered ⇒ eligible" would admit a crit
 * member naming nothing at all.
 *
 * ⚠ `headerByJose` is a `Map` read, so a CALLER-CONTROLLED member cannot resolve
 * through `Object.prototype` — `crit: ["toString"]` has found a prototype member in
 * this package's crit path twice. `in` on a caller-influenced key is a BANNED
 * construct here.
 *
 * ⚠ A TYPE PREDICATE, so a caller past this check holds a `string` without casting:
 * the registry can only answer for a member under a JOSE wire NAME.
 */
export const isCritEligible = (member: unknown): member is string =>
  isString(member) && headerByJose(member)?.critEligible === true;
