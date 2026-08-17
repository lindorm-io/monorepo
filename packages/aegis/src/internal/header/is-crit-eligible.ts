import { isString } from "@lindorm/is";
import { headerByJose } from "./header-registry.js";

/**
 * May this `crit` MEMBER stand — is it a critical extension aegis implements?
 * The ONE expression of {@link HeaderSpec.critEligible}, read by BOTH gates:
 * `assert-crit-eligible.ts` on the write and
 * `internal/utils/reject-unknown-critical.ts` on the read.
 *
 * ⚠ IT IS ITS OWN FILE BECAUSE THE TWO GATES MUST NOT BE ABLE TO DRIFT. The
 * claim the whole step rests on is "a token aegis mints is a token aegis
 * verifies", and two copies of one condition is exactly how that stops being
 * true — silently, since the mint side is richly covered and the read side's
 * disagreement with it is (today) unobservable through its own door. See
 * `reject-unknown-critical.test.ts#the read path cannot tell` for the derivation
 * and what would make it observable again.
 *
 * ⚠ It is deliberately NOT "is this parameter registered". Those two questions
 * have the same answer for every name in the registry today, because `oid` is
 * the only registered parameter that is crit-eligible AND the only one that is
 * not IANA-registered. They part company the moment a SECOND proprietary
 * parameter is registered that is not meant to be markable critical — and the
 * point of a column is that adding that parameter is a one-word decision rather
 * than a rediscovery of this reasoning.
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
 * a JOSE wire NAME, which it can only do for one. That is what lets the mint
 * gate collect the members it has admitted into a `Set<string>` to answer RFC
 * 7515 §4.1.11's duplicate prohibition in the same pass.
 */
export const isCritEligible = (member: unknown): member is string =>
  isString(member) && headerByJose(member)?.critEligible === true;
