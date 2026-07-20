import { JwsKit } from "../classes/JwsKit.js";

/**
 * True when `token` is a well-formed JWS string (three dot-separated segments,
 * an `alg` header, and a `JWS` / `JOSE` / `<type>+jws` media type). The
 * free-function, string-shape twin of `Aegis.isJws` — pylon and other consumers
 * replace the result-narrowing `isParsedJws` guard with a token-shape check that
 * needs no `Aegis` instance. Never throws.
 */
export const isJwsToken = (token: string): boolean => JwsKit.isJws(token);
