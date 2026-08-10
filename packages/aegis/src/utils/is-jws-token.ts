import { JwsKit } from "../classes/JwsKit.js";

/**
 * True when `token` is the JWS Compact Serialization (RFC 7515 §7.1): three
 * dot-separated segments, a REQUIRED `alg` header on aegis's allowlist, and no
 * `typ` requirement — §4.1.9 makes that optional, so an externally issued signed
 * token qualifies as readily as an aegis-minted one.
 *
 * ⚠ Every JWT is a JWS (RFC 7519 §3), so this is TRUE for a claims token too and
 * cannot on its own tell an opaque handle from a credential — ask
 * `isJwtToken` / `isClaimsBearingToken` for that. The free-function twin of
 * `Aegis.isJws`, needing no `Aegis` instance and no verify result. Never throws.
 */
export const isJwsToken = (token: string): boolean => JwsKit.isJws(token);
