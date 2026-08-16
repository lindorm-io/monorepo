import { isArray } from "@lindorm/is";
import { headerByDomain, headerJoseName } from "./header-registry.js";

/**
 * Remap `crit`'s members DOMAIN -> WIRE, sorted; a member the registry does not
 * know passes through unchanged. Returns `undefined` for a non-array, which is
 * what the write passes drop.
 *
 * ⚠ THE ONE VOCABULARY, and that is why it lives in its own file rather than
 * private to the write pass that first needed it. `crit`'s members are PARAMETER
 * NAMES, so anything comparing a member against a header bag's keys has to spell
 * both the same way — `{ critical: ["objectId"], objectId: "x" }` and
 * `{ crit: ["oid"], oid: "x" }` are the same statement written twice. A second
 * caller resolving members its own way is how the two ended up disagreeing:
 * members were collected raw while the bag was keyed by wire name, so `objectId`
 * matched no `oid` and the header went out naming a parameter it did not carry.
 *
 * ⚠ IT IS THE JOSE HALF of that vocabulary, applied by the SHAPING passes
 * (`token-header.ts#encodeHeaderValue`) — the COSE half is `critToCoseLabels`,
 * which takes the members one step further to the LABELS the parameters are keyed
 * under. `assertCritSatisfied` reads a bucket one of the two has already been over
 * and maps nothing itself: it cannot know which vocabulary it is holding, and RFC
 * 9052 §1.5 types a COSE label as `int / tstr` — the name `"kid"` and the label
 * `4` are both labels, and they are not the same one. So a pass
 * that stopped applying this would not merely lose a convenience — it would make
 * a satisfied `crit` written in the domain spelling refuse.
 *
 * IDEMPOTENT, which is what lets a later pass re-apply it without knowing whether
 * an earlier one did. A wire name misses `headerByDomain` and falls through
 * unchanged — including `jwk` and `zip`, the two parameters whose domain and wire
 * spellings coincide, because there the lookup lands on the same entry and
 * returns the same name.
 */
export const criticalToWire = (members: unknown): Array<string> | undefined => {
  // `<string>` states the WELL-FORMED shape, not a guarantee: a non-string member
  // misses `headerByDomain` and passes through unexamined, to be refused where
  // the spelling matters — `critToCoseLabels` on the COSE write, `validateCrit`
  // on every read.
  if (!isArray<string>(members)) return undefined;

  return members
    .map((member): string => {
      const spec = headerByDomain(member);
      return spec ? headerJoseName(spec) : member;
    })
    .sort();
};
