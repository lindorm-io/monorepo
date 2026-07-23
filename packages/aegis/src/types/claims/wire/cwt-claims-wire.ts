import type { AegisClaimsWire } from "./aegis-claims-wire.js";

/**
 * The OPEN, wire-typed CWT claim set — the COSE twin of {@link JwtClaimsWire}
 * (R13a). DERIVED from {@link AegisClaimsWire} by the ONE registry-grounded
 * JOSE↔COSE NAME divergence: RFC 8392 registers `cti` (CWT ID) where JOSE uses
 * `jti`. So this is the wire base with `jti` renamed to `cti` — same names as
 * JOSE everywhere they match (`iss`/`sub`/`aud`/`exp`/`nbf`/`iat`), `cti` only
 * where COSE has its own name. `cti` is a `string` at the type surface (the kit
 * encodes it to a CBOR `bstr` internally); the numeric CBOR labels never appear
 * in any consumer type.
 *
 * The omit/add is grounded in the claim registry's `coseName` divergence set —
 * `CLAIM_REGISTRY.filter(s => s.coseName && s.coseName !== s.jose)`, today just
 * `{ jose: "jti", coseName: "cti" }`. A drift guard (`cwt-claims-wire.test.ts`)
 * binds this transformation to that set so a new registry divergence fails to
 * compile here.
 *
 * NOTE the derivation is expressed over the CLOSED {@link AegisClaimsWire}
 * (Omit `jti`, add `cti`, THEN open with the index signature) rather than over
 * the already-open {@link JwtClaimsWire}: `Omit` on a type that carries an index
 * signature collapses every member to `unknown`, so the omit/add MUST be applied
 * before the index signature is layered on.
 */
export type CwtClaimsWire = Omit<AegisClaimsWire, "jti"> & { cti?: string } & {
  [claim: string]: unknown;
};
