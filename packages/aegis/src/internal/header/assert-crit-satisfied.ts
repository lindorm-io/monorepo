import { isArray, isEmpty } from "@lindorm/is";
import type { AegisError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";

/**
 * Refuse a FINISHED protected bucket whose `crit` names a parameter the bucket
 * gives a recipient NOTHING TO UNDERSTAND — absent, `undefined`, `null`, or empty.
 *
 * `crit` is a producer's statement that a recipient MUST understand a parameter's
 * VALUE (RFC 7515 §4.1.11, RFC 9052 §3.1). Saying that while supplying no value
 * is a contradiction, and it has to be named where it is MADE — at the write —
 * because every later reader sees only the finished header. Both specifications
 * make the finished shape fatal rather than merely unsupported: RFC 9052 §3.1 —
 * *"If the 'crit' value list includes a label for which the header parameter is
 * not in the protected-header-parameters bucket, this is a fatal error in
 * processing the message."* So a writer that emitted one would mint a token
 * EVERY recipient refuses, including the ones the producer wrote it for, and
 * aegis's own `validateCrit` refuses it on arrival.
 *
 * ⚠ ABSENT AND EMPTY ARE ONE VERDICT, and the code says it ONCE rather than in two
 * arms: the check reads the VALUE (`isEmpty(bucket.get(member))`) and `isEmpty`
 * answers `true` for the `undefined` a missing key returns. That is also what lets
 * it run on a bucket the emission prune has already been over — the prune removes
 * the empty value of a parameter whose registry cell says it carries nothing
 * (`prune-empty-headers.ts`), so by this point `oid: ""` has BECOME an absent
 * `oid`, and there is no third state for the two to be told apart into. Reading
 * the value rather than the key is also what keeps a `whenEmpty: "keep"` cell
 * covered: an empty value that SURVIVED the prune still has nothing to understand.
 *
 * ⚠ IT TAKES A COMPLETE BUCKET, never a fragment — that is the whole of what the
 * two call sites have in common, and each is the LAST point before its wire's
 * bytes exist:
 *   - `buildJoseHeader`, on the merged header. RFC 7515 §7.1 gives the compact
 *     serialisation ONE header, assembled here from four tiers, and a `crit` in
 *     one tier may name a parameter from any of the others.
 *   - `mergeCoseProtected`, on the assembled protected map — NOT `buildCoseHeaders`,
 *     which sees the caller's bag alone. The COSE protected bucket also carries the
 *     kit's derived `alg`/`typ`/`cty`, so checking the caller's fragment refused
 *     `crit: ["alg"]` on a message whose protected bucket does carry `alg`, and the
 *     two wires answered the same call differently.
 *
 * ⚠ ONE VOCABULARY, ASSUMED RATHER THAN APPLIED — the bucket and its own `crit`
 * members reach here already spelled the same way, because the pass that BUILT the
 * bucket mapped both: `criticalToWire` through `shapeWireHeader` on JOSE,
 * `critToCoseLabels` through `wireHeaderToCoseMap` on COSE. This function cannot
 * map them itself, and must not try: it does not know which of the two vocabularies
 * it is holding, and RFC 9052 §1.5 types a COSE label as `int / tstr` — the JOSE
 * name `"kid"` and the COSE label `4` are both labels, and they are not the same
 * one. It compares like with like and reports the member as the
 * bucket spells it — on COSE that is the LABEL, which is what a COSE `crit` list
 * literally contains.
 *
 * ⚠ A `Map`, NOT a plain object, and that is a safety property rather than a
 * convenience: a caller-influenced member fed to `in` or to `header[name]` walks
 * `Object.prototype`, so `crit: ["toString"]` passed a membership test no header
 * ever satisfied and aegis minted a `crit` naming a parameter it does not carry.
 * A `Map` has no prototype chain to walk. `in` on a caller-influenced key is a
 * BANNED construct in this package — use `Object.hasOwn`, or a `Map` where the
 * lookup can be structural.
 *
 * ⚠ Only the PROTECTED bucket is consulted, on both wires. RFC 7515 §4.1.11 and
 * RFC 9052 §3.1 both require a crit-named parameter to be integrity-protected, and
 * §3.1 makes a crit naming an UNPROTECTED label a fatal error in processing — so a
 * value in the COSE unprotected bucket does not satisfy the list, which is why the
 * refusal says "in the protected header" rather than "in the message". A caller
 * PLACING one there hears the accurate `cose_crit_param_unprotected` first
 * (`build-cose-headers.ts`, rule 2); what reaches here is the kit's own unprotected
 * parameters (`kid`, `iv`), which no JOSE header has a second bucket for.
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

  // `<CoseLabel>` states the WELL-FORMED shape, not a guarantee — the same claim
  // `criticalToWire` makes about `<string>`. A member of any other type simply
  // matches no key and is refused below, which is the right answer for it.
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
