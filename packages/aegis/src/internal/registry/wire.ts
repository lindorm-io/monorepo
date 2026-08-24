/**
 * The wires aegis speaks, and the one place they are enumerated. `Wire` is the
 * type every registry entry is TOTAL over (`wire: Record<Wire, WireKey>`), so a
 * third wire is a compile error in every entry rather than a silent hole.
 *
 * A wire is the SERIALISATION vocabulary, not the token format: `jose` covers
 * JWS/JWE/JWT, `cose` covers CWS/CWM/CWE/CWT. Per-KIT facts live in the kit
 * capability table — a kit fact is finer-grained than a wire fact.
 */

export type Wire = "jose" | "cose";

const WIRE_KEYS = { jose: true, cose: true } as const satisfies Record<Wire, true>;

/**
 * Every wire tag, in declaration order — DERIVED from a keyset the compiler holds
 * TOTAL over {@link Wire}, so there is never a second hand-kept list to fall out
 * of step with the first.
 */
export const WIRE_TAGS = Object.keys(WIRE_KEYS) as ReadonlyArray<Wire>;
