import { isArray, isEmpty, isString } from "@lindorm/is";
import { isSpecDefinedHeaderParam } from "../header/is-spec-defined-header-param.js";

/**
 * Validate the `crit` (Critical) header parameter. RFC 7515 §4.1.11,
 * RFC 9052 §3.1.
 *
 * Returns `null` when `crit` is valid or absent, and an error message string
 * otherwise; the caller translates a non-null return into its own error class.
 */
export const validateCrit = (
  decoded: { crit?: unknown } & Record<string, unknown>,
): string | null => {
  const crit = decoded.crit;

  if (crit === undefined) return null;

  if (!isArray(crit)) {
    return "crit must be an array";
  }

  // RFC 7515 §4.1.11
  if (crit.length === 0) {
    return "crit must not be an empty array when present";
  }

  for (const name of crit) {
    if (!isString(name)) {
      return "crit entries must be strings";
    }

    // ⚠ THE SAME PREDICATE THE WRITE SIDE REFUSES ON
    // (`internal/header/is-spec-defined-header-param.ts`). ⛔ A second list here
    // answers differently from the registry the write side reads, and the shape of
    // that failure is this line refusing a token aegis has just minted.
    if (isSpecDefinedHeaderParam(name)) {
      return `crit must not contain the specification-defined header parameter "${name}"`;
    }

    // The listed parameter must be carried. RFC 7515 §4.1.11, RFC 9052 §3.1.
    //
    // ⚠ THE BUCKET IS THE CALLER'S DECISION, NOT THIS CHECK'S. This asks only
    // whether the header it was HANDED carries the name; both read doors hand it
    // the protected bucket alone (`internal/wire/jose-token-wire.ts` and
    // `internal/wire/cose-token-wire.ts`, each through `writtenHeader`). Narrowing
    // to that bucket is the RFC's rule on COSE and AEGIS POLICY on JOSE.
    //
    // ⚠ `Object.hasOwn`, never `in`: `name` comes off a token a stranger wrote and
    // `decoded` is a plain object, so `in` resolves through `Object.prototype` and
    // `crit: ["toString"]` passes. `in` on a caller-influenced key is a BANNED
    // construct in this package.
    if (!Object.hasOwn(decoded, name)) {
      return `crit listed parameter "${name}" is not present in the header`;
    }

    // The same requirement one step further in: a present-but-EMPTY value gives a
    // recipient nothing to understand. The writer refuses the same shape at mint
    // (`assert-crit-satisfied.ts`), so the two sides give one answer.
    if (isEmpty(decoded[name])) {
      return `crit listed parameter "${name}" has an empty value`;
    }
  }

  return null;
};
