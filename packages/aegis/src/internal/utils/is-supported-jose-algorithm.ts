import { decodeJoseHeader } from "./jose-header.js";

/**
 * Does a compact JOSE token's protected header name an algorithm aegis will
 * actually process?
 *
 * The format guards split the question in two so neither half has to restate the
 * other: `@lindorm/is` owns the WIRE question (RFC 7515 / 7516 / 7519 shape, and
 * nothing else — a format guard has no business holding an algorithm policy),
 * and this owns the aegis half. `decodeJoseHeader` enforces the allowlist, which
 * is what keeps `alg: none` and every unsupported or weak algorithm from being
 * routed into a Kit at all rather than being rejected several layers deeper.
 *
 * Never throws — a header that cannot be decoded names no supported algorithm.
 */
export const isSupportedJoseAlgorithm = (token: string): boolean => {
  try {
    decodeJoseHeader(token.split(".")[0]);

    return true;
  } catch {
    return false;
  }
};
