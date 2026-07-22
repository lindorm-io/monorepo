import type { Dict } from "@lindorm/types";
import type { JwtClaims } from "../claims/wire/jwt-claims.js";
import type { WireTokenHeader } from "../header/wire-header.js";

/**
 * The uniform result of `decode` across every kit — a pure WIRE read of the
 * token structure with NO signature/MAC verification and NO decryption. Every
 * decode carries ONE unified {@link WireTokenHeader}: for JOSE it is the single
 * protected header, for JWE the protected + unprotected merge, and for COSE the
 * protected + unprotected CBOR maps merged and each integer label translated to
 * its JOSE wire name (`alg`/`kid`/`enc`/…) via the header registry. The header
 * therefore speaks the SAME vocabulary whether the token was JOSE or COSE.
 *
 * The three shapes are shared ACROSS each format pair so a consumer decoding a
 * JWT vs a CWT (or a JWS vs a CWS, a JWE vs a CWE) sees an identical structure:
 *   - {@link DecodedSignedToken}    — JWT ≡ CWT ≡ CWM (header + claims payload)
 *   - {@link DecodedOpaqueToken}    — JWS ≡ CWS       (header + opaque payload)
 *   - {@link DecodedEncryptedToken} — JWE ≡ CWE       (header only; content stays ciphertext)
 */

/**
 * A SIGNED claims token decoded to its unified wire header + cleartext WIRE
 * claims — JWT ≡ CWT ≡ CWM. NO signature/MAC verification is performed;
 * `payload` is the claim map exactly as it sits on the wire (`sub`/`exp`/…),
 * parameterised by the concrete wire-claim shape.
 */
export type DecodedSignedToken<C extends Dict = Dict> = {
  header: WireTokenHeader;
  payload: C;
};

/**
 * An OPAQUE signed token decoded to its unified wire header + the raw payload
 * bytes — JWS ≡ CWS. NO signature/MAC verification is performed; the payload is
 * the opaque secured bytes, never a decoded claim map.
 */
export type DecodedOpaqueToken = {
  header: WireTokenHeader;
  payload: Buffer;
};

/**
 * An ENCRYPTED token decoded to its unified wire header ONLY — JWE and CWE. The
 * content stays ciphertext (it needs the key — that is `decrypt`), so there is no
 * payload here; decode merely surfaces the merged header. JWE and CWE share this
 * ONE result type but their headers are structurally SIMILAR, not identical: a
 * JWE protected header carries a key-management `alg` alongside the content `enc`,
 * whereas a COSE_Encrypt0 carries only `enc` (label 1 is the AEAD, there is no
 * key-management `alg`) — so `alg` is present for JWE and absent for CWE.
 */
export type DecodedEncryptedToken = {
  header: WireTokenHeader;
};

/**
 * The JWT-shaped signed decode result — {@link DecodedSignedToken} carrying the
 * JOSE {@link JwtClaims} base plus the caller's custom claims. CWT/CWM reuse the
 * bare {@link DecodedSignedToken} with their own `CwtWireClaims` base.
 */
export type DecodedJwtToken<C extends Dict = Dict> = DecodedSignedToken<JwtClaims & C>;
