import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CLAIM_SPECS, type NameSelector } from "../claims/claims-registry.js";
import { decodeClaim } from "../claims/translate.js";

/**
 * Lift every spaced array claim of a WIRE payload from its space-delimited
 * string (RFC 8693 §4.2) to the list it spells — the sibling of `withJoseDates`
 * (`internal/utils/jose-dates.ts`): that helper puts both wires' temporal
 * claims in one shape for the matcher pass, and this one does the same for the
 * spaced lists, so a caller's containment matcher (`{ scope: "read" }`, lifted
 * to a `$all` by `lift-claim-matcher.ts`) is answered against the LIST rather
 * than against one string no list operator matches.
 *
 * ⚠ Registry-driven in both halves: WHICH claims are spaced comes from the
 * codec cell, and the split IS the read side's own decoder ({@link decodeClaim}),
 * so what the matcher sees cannot drift from what a verify result reports for
 * the same wire value.
 *
 * ⚠ A value that is not a string is carried untouched: an array is already the
 * matcher's shape, and anything else must keep failing the matchers as itself.
 */
export const withSpacedArrays = (payload: Dict, nameOf: NameSelector): Dict => {
  const out: Dict = { ...payload };

  for (const spec of CLAIM_SPECS) {
    if (spec.codec.kind !== "array") continue;
    if (spec.codec.of !== undefined) continue;
    if (spec.codec.scalar !== "spaced") continue;

    const key = nameOf(spec);

    // ⚠ `Object.hasOwn`, never `in` — the payload is a stranger's, and `in`
    // walks `Object.prototype`.
    if (!Object.hasOwn(payload, key)) continue;
    if (!isString(payload[key])) continue;

    out[key] = decodeClaim(spec, payload[key], nameOf);
  }

  return out;
};
