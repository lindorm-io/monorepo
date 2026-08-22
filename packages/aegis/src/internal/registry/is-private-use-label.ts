/**
 * Whether an integer COSE label is PRIVATE USE — the ONE predicate deciding whether
 * a parameter is lindorm-private, read by BOTH registries and BOTH directions:
 *
 *   - HEADERS, WRITE (`header-registry.ts#coseWireKey`): a private-use parameter
 *     degrades to its interop STRING label unless the caller asked for the
 *     proprietary spelling.
 *   - HEADERS, READ  (`header-registry.ts#byCoseName`): only the parameters that
 *     can be WRITTEN that way resolve back, so a foreign token cannot inject a
 *     registered parameter under a text label aegis never emits.
 *   - CLAIMS (`internal/cose/cwt-spec.ts`): the same fact drives the CBOR kit's
 *     `proprietary` dual-key.
 *
 * ⚠ IT GATES ON THE RANGE, NEVER ON A NAME. A predicate naming `oid` would go on
 * being true while the next private-use parameter shipped an uninterpretable
 * integer in a token declared interoperable.
 *
 * The boundary is the same integer in both IANA registries: RFC 8152 §16.2 (COSE
 * header parameters) and RFC 8392 §9.1.1 (CWT claim keys). Everything from -65536
 * up is registered, delegated or reserved elsewhere, so it never degrades.
 */
export const isPrivateUseLabel = (label: number): boolean => label < -65536;
