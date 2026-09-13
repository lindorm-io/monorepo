import { isArray, isNumber, isString } from "@lindorm/is";
import type { CoseError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { coseByJose } from "./header-registry.js";

/**
 * The two labels a protected bucket can carry a `crit` list under: the registered
 * integer (RFC 9052 §3.1) and the text label of the same name, which no registry
 * row answers for and which `validateCrit` judges as a crit when it reaches the
 * merged view through the custom bag (`written-header.ts`).
 *
 * ⚠ INTEGER FIRST, so a bucket whose two lists are both refusable reports the
 * registered label's verdict — the list every conformant reader judges.
 * pinned: `assert-cose-crit-carried.test.ts#reports the registered label's list
 * when both labels carry a crit`.
 */
const CRIT_LABELS: ReadonlyArray<CoseLabel> = [coseByJose("crit"), "crit"];

/**
 * A crit member as its own label space spells it, so the integer `7` and the text
 * `"7"` read apart in a refusal. RFC 9052 §1.5.
 *
 * ⚠ A member of any OTHER type is not a label at all, and it is reported as the
 * member it is rather than forced into one of the two spaces.
 */
const renderLabel = (member: unknown): string => {
  if (isNumber(member)) return `integer label ${member}`;
  if (isString(member)) return `text label "${member}"`;
  return `member ${String(member)}`;
};

/**
 * Refuse a COSE protected bucket whose `crit` names a LABEL the bucket does not
 * carry — asked on the RAW label map, where an integer label and the text label of
 * the same numeral are still different keys. RFC 9052 §1.5, RFC 9052 §3.1.
 *
 * ⛔ THE LABEL MAP, NEVER THE WIRE VIEW, and every COSE door that judges a `crit`
 * asks this one first. The read translates a bucket into the JOSE wire vocabulary,
 * where a label no registry row answers for has no wire name and becomes
 * `String(label)` (`cose-wire-header.ts`) — in the `crit` array and in the custom
 * bag alike. Asked THERE, `validateCrit` sees one name against one key, so a `crit`
 * naming the integer `7` passes on a text parameter `"7"` beside it.
 * pinned: `custom-header-params.read.test.ts#an INTEGER crit member is not
 * satisfied by a TSTR parameter of the same numeral`.
 *
 * ⚠ PRESENCE ONLY, and the empty-value half stays with `validateCrit` on the merged
 * view — every caller here runs it afterwards, so the two are not two answers to
 * one question. The mint-side twin is `assert-crit-satisfied.ts`, which asks both
 * on the bucket it is about to encode.
 *
 * ⚠ A `Map`, so the lookup is `has` and not `Object.hasOwn` or `in`: the member
 * comes off a token a stranger wrote, and a Map has no prototype chain for
 * `crit: ["toString"]` to walk. `in` on a token-influenced key is a BANNED
 * construct in this package.
 *
 * ⚠ The PROTECTED bucket alone (RFC 9052 §3.1). A `crit` in the unprotected bucket
 * is covered by no signature and gates nothing; the callers hand over the protected
 * map and never the other.
 *
 * ⛔ EVERY COSE LIST THIS PACKAGE TREATS AS A CRIT IS JUDGED HERE — both labels in
 * {@link CRIT_LABELS}. A list this gate skips can be judged nowhere at all:
 * `written-header.ts` spreads the registered bag last, so a bucket carrying a list
 * under both labels reaches the merged view with the integer label's alone.
 * pinned: `custom-header-params.read.test.ts#a crit list at the TEXT label is
 * judged by label, so an INTEGER parameter does not satisfy its TSTR member`,
 * `assert-cose-crit-carried.test.ts#judges the text label's list when every member
 * of the integer label's is carried`.
 */
export const assertCoseCritCarried = ({
  bucket,
  format,
  error,
}: {
  /** The PROTECTED bucket as its raw COSE label map, int and tstr still distinct. */
  bucket: ReadonlyMap<CoseLabel, unknown>;
  /** The wire format tag, which namespaces the refusal's code. */
  format: TokenFormatTag;
  /** The door's own error class, so the refusal names the format it came from. */
  error: typeof CoseError;
}): void => {
  for (const label of CRIT_LABELS) {
    const crit = bucket.get(label);

    // `<CoseLabel>` states the WELL-FORMED shape, not a guarantee. A `crit` that is
    // not an array at all is `validateCrit`'s verdict, on the merged view.
    if (!isArray<CoseLabel>(crit)) continue;

    for (const member of crit) {
      if (bucket.has(member)) continue;

      throw new error(
        `Invalid crit header: crit listed ${renderLabel(member)}, which the protected header does not carry`,
        {
          code: `${format}_invalid_crit`,
          // ⚠ THE LIST JUDGED, not the one at the registered label: a refusal
          // whose `data.crit` is a list the verdict did not come from tells a
          // consumer nothing about the member the message names.
          data: { crit, parameter: member },
          title: `${format.toUpperCase()} Invalid Crit`,
          details:
            "A crit member names a COSE header label, and the protected header must carry a parameter under that exact label. An integer label and the text label of the same numeral are different labels.",
        },
      );
    }
  }
};
