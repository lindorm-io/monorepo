import type { Dict } from "@lindorm/types";

/**
 * Put a JOSE-named header bag into its CANONICAL on-wire key order — alphabetical
 * by JOSE parameter name.
 *
 * The signed header BYTES are the base64url of this object's JSON, and
 * `JSON.stringify` emits keys in insertion order, so the order is part of the
 * artifact: two headers carrying the same parameters must serialise identically
 * whether a parameter arrived from the kit or from the caller's bag. Every
 * producer of a wire header therefore ends on this pass — `mapTokenHeader` for the
 * domain crossing, `buildJoseHeader` for the assembled JOSE header — rather than
 * each sorting its own way.
 *
 * ⛔ `Object.fromEntries`, NEVER `sorted[key] = …`. A caller's `custom` bag reaches
 * this pass with keys the caller chose (`build-custom-header.ts`), and assigning
 * `"__proto__"` onto a plain object sets the prototype rather than the parameter —
 * so the parameter would vanish from the SIGNED BYTES while the caller believed it
 * was written. `fromEntries` defines each key instead of setting it, so
 * `__proto__` is an ordinary own property here.
 *
 * ⚠ It stays an ORDINARY object, unlike the read side's `custom` bags, which are
 * `Object.create(null)`. Those are handed to a consumer that will look arbitrary
 * keys up on them; this one is spread, `JSON.stringify`d and compared throughout
 * the write path, and its prototype is nobody's lookup surface.
 */
export const canonicalWireHeader = <T extends Dict>(header: T): T =>
  Object.fromEntries(
    Object.keys(header)
      .sort()
      .map((key) => [key, header[key]]),
  ) as T;
