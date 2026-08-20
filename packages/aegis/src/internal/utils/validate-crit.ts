import { isArray, isEmpty, isString } from "@lindorm/is";
import { isSpecDefinedHeaderParam } from "../header/is-spec-defined-header-param.js";

/**
 * Validate the `crit` (Critical) header parameter per RFC 7515 Section 4.1.11.
 *
 * Returns `null` when `crit` is valid (or absent), and an error message string
 * when it violates one of the RFC requirements. The caller is expected to
 * translate a non-null return into its own Kit-specific error class.
 */
// Generic over any header-shaped object with an optional `crit`. This function
// only reads `crit` and performs a membership check on `decoded`, so it works
// for any header dict regardless of whether `alg` is narrowed, omitted, etc.
export const validateCrit = (
  decoded: { crit?: unknown } & Record<string, unknown>,
): string | null => {
  const crit = decoded.crit;

  if (crit === undefined) return null;

  if (!isArray(crit)) {
    return "crit must be an array";
  }

  // RFC 7515 §4.1.11: "Producers MUST NOT use the empty list [] as the crit value."
  if (crit.length === 0) {
    return "crit must not be an empty array when present";
  }

  for (const name of crit) {
    if (!isString(name)) {
      return "crit entries must be strings";
    }

    // The FIRST of RFC 7515 §4.1.11's three producer prohibitions, quoted in
    // full and split into its three parts on `internal/header/assert-crit-eligible.ts`
    // — the one file that states them, so this side cannot drift into a second
    // reading of the same sentence.
    //
    // ⚠ THE SAME PREDICATE THE WRITE SIDE REFUSES ON
    // (`internal/header/is-spec-defined-header-param.ts`). ⛔ A second list here
    // would answer differently from the registry the write side reads, and the
    // shape of that failure is this line refusing a token aegis has just minted.
    if (isSpecDefinedHeaderParam(name)) {
      return `crit must not contain the specification-defined header parameter "${name}"`;
    }

    // The THIRD producer prohibition, and the two wires state it differently:
    //   - JOSE, RFC 7515 §4.1.11 forbids "names that do not occur as Header
    //     Parameter names within the JOSE Header in the 'crit' list" — the JOSE
    //     Header, any bucket.
    //   - COSE, RFC 9052 §3.1 is stricter and names the bucket: *"If the 'crit'
    //     value list includes a label for which the header parameter is not in
    //     the protected-header-parameters bucket, this is a fatal error in
    //     processing the message."*
    //
    // ⚠ THE BUCKET IS THE CALLER'S DECISION, NOT THIS CHECK'S. This asks only
    // whether the header it was HANDED carries the name; both read doors hand it
    // the protected bucket alone (`internal/wire/jose-token-wire.ts` and
    // `internal/wire/cose-token-wire.ts`, each through `writtenHeader`). So on
    // COSE that is the RFC's own rule, and on JOSE it is AEGIS POLICY — RFC 7515
    // requires the protected header for `crit` ITSELF ("When used, this Header
    // Parameter MUST be integrity protected; therefore, it MUST occur only
    // within the JWS Protected Header"), never for the parameters it lists.
    //
    // ⚠ `Object.hasOwn`, never `in`: `name` comes off a token a stranger wrote and
    // `decoded` is a plain object, so `in` resolves through `Object.prototype` and
    // `crit: ["toString"]` passed this test on every header ever decoded. `in` on a
    // caller-influenced key is a BANNED construct in this package. It is reachable
    // the moment anything reads a `crit` this function does not refuse outright.
    if (!Object.hasOwn(decoded, name)) {
      return `crit listed parameter "${name}" is not present in the header`;
    }

    // The same requirement, one step further in: `crit` says a recipient MUST
    // understand the parameter's VALUE, so a present-but-EMPTY value gives it
    // nothing to understand and satisfies the list no better than an absent one.
    // The writer refuses the same shape at mint (`assert-crit-satisfied.ts`), so
    // the two sides of aegis give one answer.
    if (isEmpty(decoded[name])) {
      return `crit listed parameter "${name}" has an empty value`;
    }
  }

  return null;
};
