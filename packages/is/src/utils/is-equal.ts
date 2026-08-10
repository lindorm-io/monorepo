import { isArray } from "./is-array.js";
import { isArrayBuffer } from "./is-array-buffer.js";
import { isBuffer } from "./is-buffer.js";
import { isClass } from "./is-class.js";
import { isDataView } from "./is-data-view.js";
import { isDate } from "./is-date.js";
import { isDetached } from "./is-detached.js";
import { isError } from "./is-error.js";
import { isMap } from "./is-map.js";
import { isNaN } from "./is-nan.js";
import { isObject } from "./is-object.js";
import { isObjectLike } from "./is-object-like.js";
import { isRegExp } from "./is-reg-exp.js";
import { isSet } from "./is-set.js";
import { isSharedArrayBuffer } from "./is-shared-array-buffer.js";
import { type TypedArray, isTypedArray } from "./is-typed-array.js";
import { isUrl } from "./is-url.js";

/**
 * The pairs currently being compared — `expect` to every `actual` it is being
 * held against on the CURRENT path.
 */
type Visited = WeakMap<object, Set<object>>;

/**
 * Runs `compare` with the pair registered, so a cycle terminates instead of
 * recursing forever. A pair already on the path is ASSUMED equal — that is what
 * makes two self-referencing structures compare equal rather than blow the
 * stack.
 *
 * The pair is removed again on the way out, so the map only ever describes the
 * current path. A permanent memo answers the cycle question too, but it then
 * also claims a reference reachable twice must pair with the same counterpart
 * both times — false for the ordinary case of one shared object appearing in
 * two places — and it would poison the speculative comparisons the `Set` and
 * `Map` branches make while hunting for a counterpart.
 */
const compareGuarded = (
  expect: object,
  actual: object,
  visited: Visited,
  compare: () => boolean,
): boolean => {
  const pairs = visited.get(expect) ?? new Set<object>();

  if (pairs.has(actual)) {
    return true;
  }

  visited.set(expect, pairs);
  pairs.add(actual);

  try {
    return compare();
  } finally {
    pairs.delete(actual);
  }
};

// Own enumerable keys, compared as SETS rather than by count: `{ foo: undefined }`
// and `{ bar: undefined }` agree on every lookup, because a key that is missing
// reads as `undefined` just like a key that is present and undefined.
const isEqualOwnKeys = (expect: any, actual: any, visited: Visited): boolean => {
  const expectKeys = Object.keys(expect);
  const actualKeys = Object.keys(actual);

  if (expectKeys.length !== actualKeys.length) {
    return false;
  }

  for (const key of expectKeys) {
    if (!Object.hasOwn(actual, key)) {
      return false;
    }

    if (!isEqual(expect[key], actual[key], visited)) {
      return false;
    }
  }

  return true;
};

// Element-wise rather than byte-wise, so a `NaN` in a float array still equals a
// `NaN`. The kind comes from `Symbol.toStringTag`, which is backed by the
// internal slot — a value whose prototype has been stripped answers `undefined`
// instead of throwing the way `constructor.name` does. The one kind it does not
// separate is `Buffer`, which IS a `Uint8Array` and reports that tag, so
// buffer-ness is compared on its own to keep kinds sharing a byte layout apart.
const isEqualTypedArray = (
  expect: TypedArray,
  actual: TypedArray,
  visited: Visited,
): boolean => {
  if (expect[Symbol.toStringTag] !== actual[Symbol.toStringTag]) {
    return false;
  }

  if (isBuffer(expect) !== isBuffer(actual)) {
    return false;
  }

  if (isDetached(expect.buffer) || isDetached(actual.buffer)) {
    return isDetached(expect.buffer) === isDetached(actual.buffer);
  }

  if (expect.length !== actual.length) {
    return false;
  }

  for (let i = 0; i < expect.length; i++) {
    if (!isEqual(expect[i], actual[i], visited)) {
      return false;
    }
  }

  return true;
};

const compare = (expect: any, actual: any, visited: Visited): boolean => {
  if (isNaN(expect) && isNaN(actual)) {
    return true; // Explicitly handle NaN
  }

  if (expect === actual) {
    return true;
  }

  if (typeof expect !== typeof actual) {
    return false;
  }

  if (expect === null || actual === null) {
    return false;
  }

  // Plain objects FIRST, as a fast path. Every branch below identifies a
  // built-in by `instanceof` or by its tag, and no built-in is a plain object —
  // so taking this branch early cannot steal a value from them. What it avoids
  // is the tag-string allocation in `isError` / `isPromise` running on every
  // ordinary object comparison, which is most of them.
  if (isObject(expect) && isObject(actual)) {
    return compareGuarded(expect, actual, visited, () =>
      isEqualOwnKeys(expect, actual, visited),
    );
  }

  if (isDate(expect) && isDate(actual)) {
    return expect.getTime() === actual.getTime();
  }

  if (isError(expect) && isError(actual)) {
    return expect.name === actual.name && expect.message === actual.message;
  }

  if (isBuffer(expect) && isBuffer(actual)) {
    return expect.equals(actual);
  }

  if (isUrl(expect) && isUrl(actual)) {
    return expect.toString() === actual.toString();
  }

  if (isRegExp(expect) && isRegExp(actual)) {
    return expect.source === actual.source && expect.flags === actual.flags;
  }

  if (isTypedArray(expect) && isTypedArray(actual)) {
    return isEqualTypedArray(expect, actual, visited);
  }

  if (isDataView(expect) && isDataView(actual)) {
    if (isDetached(expect.buffer) || isDetached(actual.buffer)) {
      return isDetached(expect.buffer) === isDetached(actual.buffer);
    }

    return isEqualTypedArray(
      new Uint8Array(expect.buffer, expect.byteOffset, expect.byteLength),
      new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength),
      visited,
    );
  }

  if (isArrayBuffer(expect) && isArrayBuffer(actual)) {
    if (isDetached(expect) || isDetached(actual)) {
      return isDetached(expect) === isDetached(actual);
    }

    return isEqualTypedArray(new Uint8Array(expect), new Uint8Array(actual), visited);
  }

  if (isSharedArrayBuffer(expect) && isSharedArrayBuffer(actual)) {
    return isEqualTypedArray(new Uint8Array(expect), new Uint8Array(actual), visited);
  }

  if (isArray(expect) && isArray(actual)) {
    return compareGuarded(expect, actual, visited, () => {
      if (expect.length !== actual.length) {
        return false;
      }

      for (let i = 0; i < expect.length; i++) {
        if (!isEqual(expect[i], actual[i], visited)) {
          return false;
        }
      }

      return true;
    });
  }

  if (isSet(expect) && isSet(actual)) {
    return compareGuarded(expect, actual, visited, () => {
      if (expect.size !== actual.size) {
        return false;
      }

      // Identity first: `has` is O(1) and answers for every primitive value and
      // every value the two sides hold by the same reference, which is the
      // ordinary case. Only what misses is matched deeply, below.
      const unmatched = Array.from(expect).filter((value) => !actual.has(value));

      if (unmatched.length === 0) {
        return true;
      }

      // O(n²) in the values that missed — and each counterpart is CONSUMED, so
      // two values of `expect` cannot both claim the same value of `actual`.
      const candidates = Array.from(actual).filter((value) => !expect.has(value));

      for (const value of unmatched) {
        const index = candidates.findIndex((candidate) =>
          isEqual(value, candidate, visited),
        );

        if (index === -1) {
          return false;
        }

        candidates.splice(index, 1);
      }

      return true;
    });
  }

  if (isMap(expect) && isMap(actual)) {
    return compareGuarded(expect, actual, visited, () => {
      if (expect.size !== actual.size) {
        return false;
      }

      const unmatched: Array<[any, any]> = [];

      // Identity first, exactly as `Set` — an O(1) hit for every primitive key
      // and every key held by the same reference on both sides.
      for (const [key, value] of expect) {
        if (actual.has(key)) {
          if (!isEqual(value, actual.get(key), visited)) {
            return false;
          }
          continue;
        }

        unmatched.push([key, value]);
      }

      if (unmatched.length === 0) {
        return true;
      }

      // Keys compare DEEPLY, the same as `Set` values do. That costs O(n²) in
      // the keys that missed the identity pass, which is why it only runs for
      // those — a map keyed by strings never gets here. Each counterpart is
      // consumed, so two keys cannot both claim the same entry.
      const candidates = Array.from(actual).filter(([key]) => !expect.has(key));

      for (const [key, value] of unmatched) {
        const index = candidates.findIndex(
          ([candidateKey, candidateValue]) =>
            isEqual(key, candidateKey, visited) &&
            isEqual(value, candidateValue, visited),
        );

        if (index === -1) {
          return false;
        }

        candidates.splice(index, 1);
      }

      return true;
    });
  }

  // Instances of the same class, LAST — after every branch that knows a specific
  // type, so it can never steal a `Date`, a `Map`, an `Error` or a typed array.
  // Two structurally identical entities are equal; without this they never were,
  // because `isObject` (correctly) refuses to treat a class instance as a data
  // bag. `isClass` is what keeps that from over-reaching: a `Promise`, a
  // `WeakMap` or a boxed primitive shares a constructor with its twin and has no
  // own enumerable keys, so comparing keys would call any two of them equal —
  // they are excluded because of what they ARE, not by a denylist.
  if (
    isObjectLike(expect) &&
    isObjectLike(actual) &&
    expect.constructor === actual.constructor &&
    isClass(expect)
  ) {
    return compareGuarded(expect, actual, visited, () =>
      isEqualOwnKeys(expect, actual, visited),
    );
  }

  return false;
};

/**
 * Deep equality — and TOTAL: it answers `true` or `false` for any input,
 * including hostile input, because a guard that throws is worse than one that
 * answers wrong. Callers wrap a guard in `if`, never in `try`.
 *
 * The `catch` is the last line of defence, not the design. A detached buffer
 * and a stripped prototype are handled explicitly above, because an explicit
 * branch gives the RIGHT answer where the catch can only give a safe one. What
 * cannot be handled explicitly is a property whose GETTER throws: reading the
 * property IS the comparison, and refusing to invoke accessors would break
 * every legitimate getter. So that one case is caught, and reported as "not
 * equal" — the value could not be read, so it could not be shown equal.
 */
export const isEqual = (
  expect: any,
  actual: any,
  visited: Visited = new WeakMap(),
): boolean => {
  try {
    return compare(expect, actual, visited);
  } catch {
    return false;
  }
};
