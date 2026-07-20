import { JwtKit } from "../classes/JwtKit.js";

/**
 * True when `token` is a well-formed JWT string (three dot-separated segments,
 * an `alg` header, and a `JWT` / `<type>+jwt` media type). The free-function,
 * string-shape twin of `Aegis.isJwt` — pylon and other consumers replace the
 * result-narrowing `isParsedJwt` guard with a token-shape check that needs no
 * `Aegis` instance. Never throws.
 */
export const isJwtToken = (token: string): boolean => JwtKit.isJwt(token);
