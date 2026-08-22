import { isArray } from "@lindorm/is";
import { headerByDomain, headerJoseName } from "./header-registry.js";

/**
 * Remap `crit`'s members DOMAIN -> WIRE, sorted; a member the registry does not
 * know passes through unchanged. Returns `undefined` for a non-array.
 *
 * ⚠ THE ONE VOCABULARY, which is why it has its own file rather than being private
 * to a write pass. `crit`'s members are PARAMETER NAMES, so anything comparing a
 * member against a header bag's keys must spell both the same way. A second caller
 * resolving members its own way is how the two come apart — members collected raw
 * against a bag keyed by wire name means `objectId` matches no `oid`, and the
 * header goes out naming a parameter it does not carry.
 *
 * ⚠ IT IS THE JOSE HALF, applied by the SHAPING passes
 * (`token-header.ts#encodeHeaderValue`). The COSE half is `critToCoseLabels`,
 * which goes one step further to the LABELS the parameters are keyed under.
 * `assertCritSatisfied` reads a bucket one of the two has been over and maps
 * nothing itself, because the name `"kid"` and the label `4` are both labels but
 * not the same one (RFC 9052 §1.5) — so a pass that stopped applying this would
 * make a satisfied `crit` written in the domain spelling refuse.
 *
 * IDEMPOTENT, so a later pass can re-apply it without knowing whether an earlier
 * one did: a wire name misses `headerByDomain` and falls through unchanged.
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
