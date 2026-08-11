/**
 * The WIRES aegis speaks, and the one place they are enumerated.
 *
 * `Wire` is the type every registry entry is TOTAL over (`wire: Record<Wire,
 * WireKey>`), so adding a third wire is a compile error in every registry entry
 * rather than a silent hole: a new member of this union makes ~100 object
 * literals incomplete at once. `WIRES` is the value-level twin, so a wire also
 * has somewhere to carry its own facts.
 *
 * A wire is the SERIALISATION vocabulary, not the token format: `jose` covers
 * JWS/JWE/JWT, `cose` covers CWS/CWM/CWE/CWT. Per-KIT facts (which key
 * managements a kit supports, whether it has an unprotected bucket) live in the
 * kit capability table, not here — a kit fact is finer-grained than a wire fact,
 * and stating it twice would create two sources for one answer.
 */

export type Wire = "jose" | "cose";

export type WireDescriptor = {
  /** The wire's own tag — the key this descriptor is filed under. */
  wire: Wire;
  /** Human-facing name, used in error data and reports. */
  name: string;
  /**
   * Whether the wire may key a parameter by an INTEGER label. COSE labels are
   * `int / tstr` (RFC 9052 §1.5), so a COSE parameter is either an integer label
   * or a text-string name; JOSE names are always strings.
   */
  labelled: boolean;
};

export const WIRES = {
  jose: { wire: "jose", name: "JOSE", labelled: false },
  cose: { wire: "cose", name: "COSE", labelled: true },
} as const satisfies Record<Wire, WireDescriptor>;

/**
 * Every wire tag, in declaration order — DERIVED from {@link WIRES} so there is
 * never a second hand-kept list to fall out of step with the first.
 */
export const WIRE_TAGS = Object.keys(WIRES) as ReadonlyArray<Wire>;
