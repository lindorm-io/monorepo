import { JwsKit } from "../classes/JwsKit.js";

/**
 * True when `token` is a well-formed JWS string (three dot-separated segments,
 * an `alg` header, and a `JWS` / `JOSE` / `<type>+jws` media type). The
 * free-function, string-shape twin of `Aegis.isJws` — pylon and other consumers
 * discriminate a JWS from a JWT by this token-shape check, which needs no `Aegis`
 * instance and no verify result. Never throws.
 */
export const isJwsToken = (token: string): boolean => JwsKit.isJws(token);
