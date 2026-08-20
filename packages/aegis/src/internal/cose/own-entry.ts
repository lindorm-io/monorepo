import { isNumber, isString } from "@lindorm/is";

/**
 * Read a COSE translation table under a key that came from OUTSIDE — a caller's
 * JWK, or a foreign token's COSE_Key / protected header.
 *
 * ⛔ `table[key]` ALONE IS A FAIL-OPEN. A plain object resolves through
 * `Object.prototype`, so `crv: "constructor"` answers with a live function
 * instead of `undefined` and every `=== undefined` guard beside such a lookup
 * waves it through. Measured on a foreign CWT: a `cnf` COSE_Key of
 * `{1: 2, -1: "constructor", …}` put `Object` itself into the read result's
 * `cnf.jwk.crv`. Pinned in `cose-key.test.ts#COSE_Key labels that name an
 * Object.prototype member`, `alg-labels.test.ts`, `enc-labels.test.ts` and —
 * for the token-controlled door — `CweKit.test.ts#CweKit — a protected alg label
 * naming an Object.prototype member`.
 *
 * `Object.hasOwn` is the idiom `encodeCnf` already uses in this package for the
 * same reason; `in` on a caller-influenced key is a BANNED construct here. A
 * non-string, non-number key is no table key at all, so it answers `undefined`
 * rather than being stringified into one.
 *
 * ⚠ A DIGIT STRING RESOLVES IN A NUMBER-KEYED TABLE, AND THAT IS NOT THE HOLE
 * ABOVE. A JS object's own keys ARE strings, so `Object.hasOwn(COSE_TO_ENC, "1")`
 * is true against `{ 1: "A128GCM" }` (`internal/cose/enc-labels.ts`) and the text
 * label `"1"` answers with the INTEGER label 1's algorithm. COSE keys the two
 * apart — RFC 9052 §1.5 admits both forms with the grammar `label = int / tstr`,
 * and the CDDL types `alg` as `? 1 => int / tstr`, so a producer CAN write a
 * text `"1"` — and the tables here are integer-label tables only. `own-entry`
 * PRESERVES the behaviour the direct index had; narrowing it to numbers is a
 * behaviour change, not a prototype fix, so it is filed rather than taken here:
 * `TODO-MONOREPO.md`, "COSE structural guards: one class of defect".
 */
export const ownEntry = <T>(
  table: Readonly<Record<string, T>> | Readonly<Record<number, T>>,
  key: unknown,
): T | undefined =>
  (isString(key) || isNumber(key)) && Object.hasOwn(table, key)
    ? (table as Record<string | number, T>)[key]
    : undefined;
