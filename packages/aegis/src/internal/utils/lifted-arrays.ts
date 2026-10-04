import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CLAIM_SPECS, type NameSelector } from "../claims/claims-registry.js";
import { decodeClaim } from "../claims/translate.js";
import type { ArrayScalar } from "../registry/claim-spec.js";

/**
 * Which array policies have a STRING wire form standing for a list: the
 * space-delimited one (RFC 8693 §4.2) and the lone audience (RFC 7519 §4.1.3).
 * A `strict` array has none, so its scalar is not a list this helper may invent
 * boundaries for.
 *
 * ⚠ A table over {@link ArrayScalar}, not a set of the two: a new policy does
 * not compile until this answers for it, where a set would leave the new claim's
 * string form facing a list operator no string satisfies.
 */
const LIFTED: Readonly<Record<ArrayScalar, boolean>> = {
  spaced: true,
  strict: false,
  wrap: true,
};

/**
 * Lift every list claim of a WIRE payload whose string form stands for a list, so a
 * caller's containment matcher (`{ scope: "read" }`,
 * `{ audience: "https://rs.lindorm.io/" }`, lifted to a `$all` by
 * `lift-claim-matcher.ts`) is answered against the LIST rather than against one
 * string no list operator matches. The sibling of `withJoseDates`
 * (`internal/utils/jose-dates.ts`), which puts both wires' temporal claims in one
 * shape for the same matcher pass.
 *
 * `scope`'s space-delimited string (RFC 8693 §4.2) lifts to the list it spells and
 * a lone `aud` (RFC 7519 §4.1.3) to the one-element list it names.
 *
 * ⚠ Registry-driven in both halves: WHICH claims lift comes from the codec cell
 * ({@link LIFTED}), and the lift IS the read side's own decoder
 * ({@link decodeClaim}), so what the matcher sees cannot drift from what a
 * verify result reports for the same wire value.
 *
 * ⚠ A value that is not a string is carried untouched: an array is already the
 * matcher's shape, and anything else must keep failing the matchers as itself.
 */
export const withLiftedArrays = (payload: Dict, nameOf: NameSelector): Dict => {
  const out: Dict = { ...payload };

  for (const spec of CLAIM_SPECS) {
    if (spec.codec.kind !== "array") continue;
    if (spec.codec.of !== undefined) continue;
    if (!LIFTED[spec.codec.scalar]) continue;

    const key = nameOf(spec);

    // ⚠ `Object.hasOwn`, never `in` — the payload is a stranger's, and `in`
    // walks `Object.prototype`.
    if (!Object.hasOwn(payload, key)) continue;
    if (!isString(payload[key])) continue;

    out[key] = decodeClaim(spec, payload[key], nameOf);
  }

  return out;
};
