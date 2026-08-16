import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { isEmptyScalar, omitFromArray, omitFromObject } from "../internal/index.js";

/**
 * Recursively strips the three values that carry no information — `undefined`,
 * `null`, and `""` — from wherever they appear: as an object property AND as an
 * array element (the array is reindexed).
 *
 * **A CONTAINER IS NEVER REMOVED.** An array or plain object survives whether it
 * was empty on input or became empty after cleaning — `{ a: { b: "" } }` yields
 * `{ a: {} }`, `{ a: ["", ""] }` yields `{ a: [] }`. This is the whole point of
 * the function: an empty container is a STATEMENT (an explicitly granted-nothing
 * list, an RFC 8417 `events` payload), whereas an empty scalar is noise. Use
 * `omitEmpty` instead when empty containers should be pruned too.
 *
 * `0` and `false` are values, not absence, and are always kept.
 *
 * ⚠ A `Map`, `Set`, buffer, `Date`, `RegExp` or class instance is **carried
 * through by reference and never walked or dropped.** Recursion is gated on
 * `isArray`/`isObject`, and `isObject` decides by PROTOTYPE — an exotic keeps
 * its state where `Object.entries` cannot see it, so rebuilding one key-by-key
 * would silently destroy it (a walked `Buffer` becomes `{"0":1,"1":2,…}`, a
 * walked `Map` becomes `{}`). Note this also means an EMPTY `Map`/`Set` survives
 * here where `omitEmpty` — which reads their `size` — strips it; that is the
 * container rule applied consistently, not an oversight.
 *
 * Accepts an array or a plain object; throws `TypeError` for anything else.
 */
export function omitEmptyScalars<T extends Array<any> = Array<any>>(array: T): T;
export function omitEmptyScalars<T extends Dict = Dict>(dict: T): T;
export function omitEmptyScalars<T extends Array<any>>(arg: T): T {
  if (isArray(arg)) {
    return omitFromArray<T>(arg, isEmptyScalar);
  }
  if (isObject(arg)) {
    return omitFromObject<T>(arg, isEmptyScalar);
  }
  throw new TypeError(`Unsupported type [ ${typeof arg} ]`);
}
