import { JwtKit } from "../classes/JwtKit.js";

/**
 * True when `token` is a JWT: a JWS whose payload is a JSON claims set (RFC 7519
 * §3), signed with an algorithm on aegis's allowlist. The `typ` header is a hint
 * and never the discriminant (RFC 7519 §5.1), so a typ-less id_token qualifies,
 * as do RFC 9068 `at+jwt`, RFC 9449 `dpop+jwt` and RFC 8417 `secevent+jwt`.
 *
 * FALSE for a signed OPAQUE payload — with or without a `typ`, and including one
 * that DECLARES a claims type over a non-claims payload. The free-function twin
 * of `Aegis.isJwt`, needing no `Aegis` instance and no verify result. Never
 * throws.
 */
export const isJwtToken = (token: string): boolean => JwtKit.isJwt(token);
