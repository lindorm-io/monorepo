import { isString } from "@lindorm/is";

const BASE64URL_ALPHABET = /^[A-Za-z0-9_-]*$/;

/**
 * RFC 7515 §2, RFC 7515 Appendix C.
 *
 * ⚠ Not `B64.isBase64Url`, which admits padding and a length no octet sequence
 * encodes to, and not `B64.toBuffer`, which skips whitespace. pinned:
 * is-base64url-encoding.test.ts.
 */
export const isBase64UrlEncoding = (value: unknown): value is string =>
  isString(value) && BASE64URL_ALPHABET.test(value) && value.length % 4 !== 1;
