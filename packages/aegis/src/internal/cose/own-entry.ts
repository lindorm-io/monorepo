import { isNumber, isString } from "@lindorm/is";

/**
 * A table keyed by the COSE integer label. Anything but a number is no key here.
 *
 * ⛔ THE TWO KEY SPACES DO NOT MEET, which is why there are two lookups: a JS
 * object's own keys are strings, so `Object.hasOwn(COSE_TO_ENC, "3")` is true and
 * one lookup serving both types answers integer label 3's algorithm for the text
 * `"3"`. A text label is no key in an integer-keyed table: it falls out as
 * `undefined` and meets whatever refusal that table's reader owes an unknown value.
 * Pinned in `CweKit.test.ts#CweKit — a protected alg label spelled as a digit text
 * string` and `cose-key.test.ts#COSE_Key labels spelled as digit text strings`.
 */
export const ownIntEntry = <T>(
  table: Readonly<Record<number, T>>,
  key: unknown,
): T | undefined => (isNumber(key) && Object.hasOwn(table, key) ? table[key] : undefined);

/**
 * A table keyed by the JOSE/JWK name. Anything but a string is no key here.
 *
 * ⛔ `table[key]` alone is a FAIL-OPEN: a plain object resolves through
 * `Object.prototype`, so `crv: "constructor"` answers with a live function and every
 * `=== undefined` guard beside such a lookup waves it through. Pinned in
 * `cose-key.test.ts#a caller JWK whose crv is`,
 * `cose-key-thumbprint.test.ts#a curve name the table does not own`, and the
 * `is not an official COSE` / `has no COSE label and is refused` rows of
 * `alg-labels.test.ts` and `enc-labels.test.ts`. `in` on a caller-influenced key is
 * a BANNED construct here.
 */
export const ownTextEntry = <T>(
  table: Readonly<Record<string, T>>,
  key: unknown,
): T | undefined => (isString(key) && Object.hasOwn(table, key) ? table[key] : undefined);
