import { JwtKit } from "../classes/JwtKit.js";

/**
 * True when `token` is a well-formed JWT string (three dot-separated segments,
 * an `alg` header, and a `JWT` / `<type>+jwt` media type). The free-function,
 * string-shape twin of `Aegis.isJwt` — pylon and other consumers discriminate a
 * JWT from a JWS by this token-shape check, which needs no `Aegis` instance and no
 * verify result. Never throws.
 */
export const isJwtToken = (token: string): boolean => JwtKit.isJwt(token);
