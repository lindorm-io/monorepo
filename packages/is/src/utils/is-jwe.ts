import { parseTokenHeader } from "../internal/index.js";
import { isString } from "./is-string.js";

/**
 * RFC 7516 §7.1: `BASE64URL(UTF8(JWE Protected Header)) || '.' ||
 * BASE64URL(JWE Encrypted Key) || '.' || BASE64URL(JWE Initialization Vector) ||
 * '.' || BASE64URL(JWE Ciphertext) || '.' || BASE64URL(JWE Authentication Tag)`.
 * The encrypted key is empty for Direct Key Agreement / Direct Encryption, and
 * the IV and tag are empty for algorithms that use neither; header and
 * ciphertext are always populated.
 */
const REGEX =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

/**
 * Is this the JWE Compact Serialization? Decided by the five-segment wire
 * grammar and the two REQUIRED header parameters — `alg` (§4.1.1) and `enc`
 * (§4.1.2) — never by `typ`, which RFC 7516 does not require at all.
 *
 * `enc` is what distinguishes a JWE protected header from a JWS one, so it is
 * checked rather than assumed: a five-segment token without it is not a JWE any
 * implementation could process.
 */
export const isJwe = (input: any): input is string => {
  if (!isString(input)) return false;
  if (!REGEX.test(input)) return false;

  const header = parseTokenHeader(input);

  return isString(header?.alg) && isString(header?.enc);
};
