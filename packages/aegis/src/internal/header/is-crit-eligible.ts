import { isString } from "@lindorm/is";
import { headerByJose } from "./header-registry.js";

/**
 * May a PRODUCER mark this `crit` MEMBER critical — is it a critical extension
 * aegis implements? The ONE expression of {@link HeaderSpec.critEligible}, and
 * the registry half of the WRITE gate's rule
 * (`internal/header/assert-crit-eligible.ts`; the other half is a custom
 * parameter the same call writes).
 *
 * ⛔ WRITE-SIDE ONLY — THIS COLUMN, not the registry. The read gate reads the
 * registry as well (the `spec` column, through `validateCrit`), but only ever to
 * REFUSE, and it never admits a member on the strength of a cell: `oid` included,
 * acceptance there needs the CALLER's declaration, which is necessary and not
 * sufficient. The read rule is stated once, on
 * `internal/utils/reject-unknown-critical.ts`. That aegis registers a parameter
 * says nothing about whether the application behind aegis can act on one, and
 * RFC 7515 §4.1.11 puts that duty on the recipient.
 *
 * ⚠ It is deliberately NOT "is this parameter registered". Those two questions
 * have the same answer for every name in the registry today, because `oid` is
 * the only registered parameter that is crit-eligible AND the only one that is
 * not IANA-registered. They part company the moment a SECOND proprietary
 * parameter is registered that is not meant to be markable critical — and the
 * point of a column is that adding that parameter is a one-word decision rather
 * than a rediscovery of this reasoning. Pinned in `is-crit-eligible.test.ts`.
 *
 * ⚠ An UNREGISTERED name answers `false` here, which is not the write gate's
 * final verdict: `assert-crit-eligible.ts` admits it when the same call writes it
 * as a CUSTOM parameter. Widening this predicate to "not registered ⇒ eligible"
 * would admit a crit member naming nothing at all.
 *
 * ⚠ `headerByJose` is a `Map` read, so a CALLER-CONTROLLED member cannot resolve
 * through `Object.prototype`. `crit: ["toString"]` has found a prototype member
 * in this package's crit path twice. `in` on a caller-influenced key is a BANNED
 * construct here.
 *
 * A non-string member is never eligible: a `crit` member is a parameter NAME,
 * and the malformedness of anything else is answered by the checks written for
 * it (`validate-crit.ts` on the read, the codec guard on the write).
 *
 * ⚠ A TYPE PREDICATE, so a caller that has cleared this check holds a `string`
 * without casting: eligibility means the registry answered for the member under
 * a JOSE wire NAME, which it can only do for one.
 */
export const isCritEligible = (member: unknown): member is string =>
  isString(member) && headerByJose(member)?.critEligible === true;
