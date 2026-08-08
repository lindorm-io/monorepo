import { isArray, isBuffer, isObjectLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";

/**
 * Detach a hydrated value from the entity it was assigned to, so the snapshot
 * cannot be mutated THROUGH the entity.
 *
 * Recording the entity's own values by reference made the snapshot and the
 * entity the SAME object for every mutable value. An in-place mutation — the
 * natural way to touch an @Embedded field, a json payload or an array —
 * mutated both, so `diffColumns` compared the object with itself, found
 * nothing changed, and the update wrote nothing, raised nothing and bumped no
 * version. Replacing a value wholesale kept working, which is why it went
 * unnoticed.
 *
 * The copy covers exactly the shapes `diffColumns` knows how to compare: a
 * Date by timestamp, a Buffer by bytes, arrays and object-likes by structure,
 * everything else by value. A value whose state does NOT live on its own
 * enumerable properties (a Map, a Set — reachable only through a custom
 * `@Transform`) is copied as the property bag it exposes, which is the same
 * view the comparator already takes of it.
 *
 * It must be deep: the comparator recurses, and a nested in-place mutation
 * (`entity.meta.nested.x = …`) is the ordinary case a shallow copy would still
 * lose. Prototypes are preserved, so an @Embeddable stays an instance of its
 * class — `buildOldEntity` reads these values back out as the prior state.
 *
 * Immutable values (strings, numbers, booleans, bigints, null, undefined) are
 * stored directly. Hydration runs per row on every read, so the common field
 * costs a handful of predicates and no allocation; only a genuinely mutable
 * value pays for a copy.
 */
export const copySnapshotValue = (value: unknown): unknown => copyValue(value, null);

/**
 * `instanceof` rather than `isDate`, which rejects an INVALID Date — one of
 * those would otherwise fall through to the structural branch and come back as
 * an empty object wearing `Date.prototype`. `diffColumns` draws the line in the
 * same place.
 *
 * `seen` is created on the first structural descent, so a scalar field never
 * allocates one. It also makes shared and cyclic references come out shared and
 * cyclic rather than duplicated or looping forever.
 */
const copyValue = (value: unknown, seen: WeakMap<object, unknown> | null): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (isBuffer(value)) return Buffer.from(value);
  if (!isArray(value) && !isObjectLike(value)) return value;

  return copyStructure(value as object, seen ?? new WeakMap());
};

const copyStructure = (value: object, seen: WeakMap<object, unknown>): unknown => {
  const seenCopy = seen.get(value);
  if (seenCopy !== undefined) return seenCopy;

  if (isArray(value)) {
    const copy: Array<unknown> = new Array(value.length);
    seen.set(value, copy);

    for (let index = 0; index < value.length; index++) {
      copy[index] = copyValue(value[index], seen);
    }

    return copy;
  }

  // `Object.keys` + indexed reads rather than `Object.entries`, which allocates
  // a two-element array per property — the read path walks every node of every
  // json payload, so the per-node allocation is the whole cost.
  const prototype = Object.getPrototypeOf(value);
  const copy = (prototype === Object.prototype ? {} : Object.create(prototype)) as Dict;
  seen.set(value, copy);

  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    copy[key] = copyValue((value as Dict)[key], seen);
  }

  return copy;
};
