import type { CoseLabel } from "./cose-label.js";

/**
 * ⚠ ON `has`, NEVER ON THE VALUE (RFC 9052 §3) — `Map.get` answers `null` for the
 * CBOR null and `undefined` for the CBOR undefined, both values the producer
 * stated, so a `??` would let the bucket whoever last held the token can rewrite
 * answer instead. pinned: read-protected-first.test.ts
 */
export const readProtectedFirst = ({
  label,
  protectedMap,
  unprotected,
}: {
  label: CoseLabel;
  /** `undefined` where the protected slot holds no readable map: it states nothing. */
  protectedMap: Map<CoseLabel, unknown> | undefined;
  /** The unprotected slot AS CBOR DECODED IT — narrowed here, never cast. */
  unprotected: unknown;
}): unknown => {
  if (protectedMap?.has(label)) return protectedMap.get(label);

  return unprotected instanceof Map ? unprotected.get(label) : undefined;
};
