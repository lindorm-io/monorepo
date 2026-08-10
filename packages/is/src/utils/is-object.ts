import type { Dict } from "@lindorm/types";

/**
 * A PLAIN data bag — everything it holds is reachable through `Object.entries`.
 * Use `isObjectLike` for the broad "is a non-array object" check.
 *
 * Decided by PROTOTYPE rather than by excluding known built-ins. A `Map`, a
 * `RegExp`, a class instance and a `Date` all keep their state where
 * `Object.entries` cannot see it, so treating one as a data bag silently
 * destroys it (a `Map` rebuilt key-by-key becomes `{}`). A denylist has to name
 * every such type to stay correct, and anything it misses — or anything the
 * language adds later — falls through as a data bag. This asks the opposite
 * question: is the prototype the ordinary object one, or nothing at all?
 * Everything else is excluded because of what it IS, not because it was
 * remembered.
 *
 * `=== Object.prototype` answers first because nearly every data bag is an
 * ordinary object from THIS realm. The chain walk behind it is what keeps
 * CROSS-REALM values working: an object from a `vm` context or a worker carries
 * that realm's `Object.prototype`, which is a different identity but still the
 * root of its chain. The fast path only ever confirms what the walk would have
 * concluded — `Object.prototype` IS the root of this realm's chain — so it
 * cannot change an answer, only skip the work of reaching it.
 */
export const isObject = <T extends Dict = Dict>(input: any): input is T => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const proto = Object.getPrototypeOf(input);

  if (proto === Object.prototype) return true;
  if (proto === null) return true;

  let root = proto;
  while (Object.getPrototypeOf(root) !== null) {
    root = Object.getPrototypeOf(root);
  }

  return proto === root;
};
