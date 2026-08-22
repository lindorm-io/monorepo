import { isArray, isEmpty } from "@lindorm/is";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";

/**
 * Refuse a FINISHED protected bucket whose `crit` names a parameter the bucket
 * gives a recipient NOTHING TO UNDERSTAND — absent, `undefined`, `null`, or empty.
 *
 * ⚠ THE VALUE-SIDE HALF OF A PAIR. `assert-crit-eligible.ts` is the NAME-side one
 * and runs FIRST, on the caller's bag; this one asks whether the finished bucket
 * carries a value. They need different inputs — a name can be judged before any
 * tier is merged, a value cannot.
 *
 * `crit` states that a recipient MUST understand a parameter's VALUE (RFC 7515
 * §4.1.11, RFC 9052 §3.1), and both specifications make the contradictory shape
 * FATAL rather than merely unsupported. It has to be named at the WRITE, because
 * every later reader sees only the finished header — a token emitted with one is
 * refused by every recipient, aegis's own `validateCrit` included.
 *
 * ⚠ ABSENT AND EMPTY ARE ONE VERDICT, said once: the check reads the VALUE
 * (`isEmpty(bucket.get(member))`) and `isEmpty` answers `true` for the `undefined`
 * a missing key returns.
 *
 * ⚠ THE EMPTY ARM IS UNREACHABLE TODAY. The registry has no `whenEmpty: "keep"`
 * header cell (asserted `toEqual([])` in `header-registry.test.ts`), so nothing
 * empty survives the prune, and the one `refuse` cell throws in `normaliseHeaders`
 * before a bucket is assembled. The value-read is kept over a key-test because a
 * `keep` cell is one registry edit away, and a key-test would silently start
 * accepting an empty value the day one lands.
 *
 * ⚠ IT TAKES A COMPLETE BUCKET, never a fragment — each call site is the LAST point
 * before its wire's bytes exist:
 *   - `buildJoseHeader`, on the merged header — the compact serialisation has ONE
 *     header (RFC 7515 §7.1), and a `crit` in one tier may name a parameter from
 *     any other.
 *   - `mergeCoseProtected`, on the assembled protected map — NOT `buildCoseHeaders`,
 *     which sees the caller's bag alone. The COSE protected bucket also carries the
 *     kit's derived `alg`/`typ`/`cty`, so checking the fragment would refuse
 *     `crit: ["alg"]` on a message whose protected bucket does carry `alg`.
 *
 * ⚠ ONE VOCABULARY, ASSUMED RATHER THAN APPLIED. The pass that BUILT the bucket
 * mapped both it and its `crit` members — `criticalToWire` through
 * `shapeWireHeader` on JOSE, `critToCoseLabels` through `wireHeaderToCoseMap` on
 * COSE. This function cannot map them itself and must not try: it does not know
 * which vocabulary it holds, and the JOSE name `"kid"` and the COSE label `4` are
 * both labels but not the same one (RFC 9052 §1.5). It reports the member as the
 * bucket spells it.
 *
 * ⚠ A `Map`, NOT a plain object, and that is a safety property: a caller-influenced
 * member fed to `in` or to `header[name]` walks `Object.prototype`, so
 * `crit: ["toString"]` passes a membership test no header satisfies. `in` on a
 * caller-influenced key is a BANNED construct in this package.
 *
 * ⚠ Only the PROTECTED bucket is consulted, on both wires (RFC 7515 §4.1.11,
 * RFC 9052 §3.1), which is why the refusal says "in the protected header" rather
 * than "in the message". A caller PLACING one in the unprotected bucket hears the
 * accurate `cose_crit_param_unprotected` first (`build-cose-headers.ts`, rule 1b);
 * what reaches here is the kit's own unprotected parameters.
 */
export const assertCritSatisfied = ({
  bucket,
  critKey,
  format,
  error,
}: {
  /** The assembled protected bucket, keyed the way its own wire keys it. */
  bucket: ReadonlyMap<CoseLabel, unknown>;
  /** The key `crit` itself is written under in that bucket: `"crit"`, or label 2. */
  critKey: CoseLabel;
  /** The wire format tag, which namespaces the error code. */
  format: TokenFormatTag;
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof AegisError;
}): void => {
  const crit = bucket.get(critKey);

  // `<CoseLabel>` states the WELL-FORMED shape, not a guarantee. A member of any
  // other type matches no key and is refused below, which is the right answer.
  if (!isArray<CoseLabel>(crit)) return;

  for (const member of crit) {
    if (!isEmpty(bucket.get(member))) continue;

    throw new error(
      `Invalid crit header: crit listed parameter "${String(member)}" carries no value in the protected header`,
      {
        code: `${format}_invalid_crit`,
        data: { crit, parameter: member },
        title: `${format.toUpperCase()} Invalid Crit`,
        details:
          "Naming a parameter in crit states that a recipient must understand its value, so the protected header has to carry one. An absent, undefined, null or empty value gives the recipient nothing to understand, and a crit naming a parameter the protected header does not provide is malformed for every recipient rather than merely unsupported.",
      },
    );
  }
};
