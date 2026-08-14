/**
 * Whether an integer COSE label is PRIVATE USE — the ONE predicate that decides
 * whether a parameter is lindorm-private, read by BOTH registries and BOTH
 * directions:
 *
 *   - HEADERS, WRITE (`header-registry.ts#coseWireKey`): a private-use parameter
 *     degrades to its interop STRING label unless the caller asked for the
 *     proprietary spelling.
 *   - HEADERS, READ  (`header-registry.ts#byCoseName`): the string spelling is
 *     resolvable back to the parameter — and ONLY for the parameters that can be
 *     written that way, so a foreign token cannot inject a registered parameter
 *     under a text label aegis never emits.
 *   - CLAIMS (`internal/cose/cwt-spec.ts`): the same fact drives the CBOR kit's
 *     `proprietary` dual-key, which is where the interop promise was already kept.
 *
 * ⚠ IT GATES ON THE RANGE, NEVER ON A NAME. `oid` (label -70000) is the only
 * private-use HEADER parameter today, but a predicate that said "oid" would go on
 * being true while the next private-use parameter shipped an uninterpretable
 * integer in a token declared interoperable — which is the exact defect this
 * repairs.
 *
 * The boundary is the same integer in both IANA registries, and both state it in
 * the same words:
 *
 *   - RFC 8152 §16.2 (COSE Header Parameters; RFC 9052 §11.1 re-points the
 *     registry's reference without restating the ranges) — "Integer values less
 *     than -65536 are marked as private use."
 *   - RFC 8392 §9.1.1 (CWT Claims, Claim Key) — "Integer values less than -65536
 *     are marked as Private Use."
 *
 * Everything from -65536 up is registered, delegated or reserved to somebody
 * else, so it is interoperable as an integer and never degrades.
 */
export const isPrivateUseLabel = (label: number): boolean => label < -65536;
