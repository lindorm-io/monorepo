import { parseTokenHeader } from "../internal/index.js";
import { isString } from "./is-string.js";

/**
 * RFC 7515 §7.1: `BASE64URL(UTF8(JWS Protected Header)) || '.' ||
 * BASE64URL(JWS Payload) || '.' || BASE64URL(JWS Signature)`. Only the header is
 * always populated — the payload segment is EMPTY for detached content
 * (appendix F) and the signature segment is EMPTY for an Unsecured JWS (§2).
 */
const REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/;

/**
 * Is this the JWS Compact Serialization? Decided by the wire grammar and the
 * REQUIRED `alg` header (RFC 7515 §4.1.1) — never by `typ`, which §4.1.9 makes
 * OPTIONAL and which most issuers omit.
 *
 * A JWT is a JWS whose payload is a claims set (RFC 7519 §3), so `isJwt` is a
 * SUBSET of this: every JWT answers true here. Use `isJwt` to ask the narrower
 * question, and this one to ask "is it signed JOSE at all".
 *
 * Shape only: `alg` is not checked against any algorithm registry, so an
 * Unsecured `alg: "none"` JWS is still a JWS. Rejecting weak algorithms belongs
 * to the verifier, not to a format guard.
 */
export const isJws = (input: any): input is string => {
  if (!isString(input)) return false;
  if (!REGEX.test(input)) return false;

  return isString(parseTokenHeader(input)?.alg);
};
