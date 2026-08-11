/**
 * How ONE parameter is keyed on ONE wire — the cell of the `wire: Record<Wire,
 * WireKey>` column every registry entry declares.
 *
 * The point of the union is that `absent` is a STATED FACT carrying its reason,
 * not a missing entry. Before this, "this parameter has no COSE form" was spelled
 * as an optional field left off (`cose?: number`), so a drop was indistinguishable
 * from an oversight and the reason lived — where it lived at all — in a comment.
 */

export type WireKey =
  /** Keyed by a string name on this wire (JOSE always; COSE where the name is the smaller encoding). */
  | { kind: "name"; name: string }
  /**
   * Keyed by an integer label on this wire. `name` is the interop STRING
   * fallback — the spelling used when the token degrades to string keys
   * (a private-use label off-platform), and the vocabulary the translator speaks.
   */
  | { kind: "label"; label: number; name: string }
  /** Not carried on this wire at all. `reason` is REQUIRED: a drop becomes a fact. */
  | { kind: "absent"; reason: string };

/** Keyed by a string name on this wire. */
export const wireName = (name: string): WireKey => ({ kind: "name", name });

/**
 * Keyed by an integer label on this wire, with `name` as the interop string
 * fallback (defaults to the label's own JOSE-side spelling where they agree).
 */
export const wireLabel = (label: number, name: string): WireKey => ({
  kind: "label",
  label,
  name,
});

/** Not carried on this wire — `reason` says why, and is not optional. */
export const wireAbsent = (reason: string): WireKey => ({ kind: "absent", reason });

/** The wire NAME a key carries, or `undefined` where the parameter is absent. */
export const wireKeyName = (key: WireKey): string | undefined =>
  key.kind === "absent" ? undefined : key.name;

/** The INTEGER label a key carries, or `undefined` where it is name-keyed or absent. */
export const wireKeyLabel = (key: WireKey): number | undefined =>
  key.kind === "label" ? key.label : undefined;
