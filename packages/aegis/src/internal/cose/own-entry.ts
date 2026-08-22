import { isNumber, isString } from "@lindorm/is";

/**
 * Read a COSE translation table under a key that came from OUTSIDE — a caller's
 * JWK, or a foreign token's COSE_Key / protected header.
 *
 * ⛔ `table[key]` alone is a FAIL-OPEN: a plain object resolves through
 * `Object.prototype`, so `crv: "constructor"` answers with a live function and
 * every `=== undefined` guard beside such a lookup waves it through. Pinned in
 * `cose-key.test.ts#COSE_Key labels that name an Object.prototype member`,
 * `alg-labels.test.ts`, `enc-labels.test.ts`, and — for the token-controlled door
 * — `CweKit.test.ts#CweKit — a protected alg label naming an Object.prototype
 * member`. `in` on a caller-influenced key is a BANNED construct here.
 *
 * A non-string, non-number key is no table key at all and answers `undefined`
 * rather than being stringified into one.
 *
 * ⚠ A DIGIT STRING STILL RESOLVES IN A NUMBER-KEYED TABLE, and that is a separate
 * question: a JS object's own keys are strings, so `Object.hasOwn(COSE_TO_ENC,
 * "1")` is true and the text label `"1"` answers with integer label 1's
 * algorithm, while COSE keys the two apart (RFC 9052 §1.5). This preserves the
 * behaviour the direct index had; narrowing to numbers is a behaviour change and
 * is filed in `TODO-MONOREPO.md`, "COSE structural guards: one class of defect".
 */
export const ownEntry = <T>(
  table: Readonly<Record<string, T>> | Readonly<Record<number, T>>,
  key: unknown,
): T | undefined =>
  (isString(key) || isNumber(key)) && Object.hasOwn(table, key)
    ? (table as Record<string | number, T>)[key]
    : undefined;
