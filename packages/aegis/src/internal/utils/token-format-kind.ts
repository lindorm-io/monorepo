import type { TokenFormatTag } from "../../types/index.js";

/**
 * What a token format IS, structurally — the one question every domain verb asks
 * before it does anything else.
 *
 *   - `"claims"`     carries a readable claims layer (jwt / cwt / cwm).
 *   - `"opaque"`     signed, but with no claims layer (jws / cws).
 *   - `"encrypted"`  an encrypting outer whose content is ciphertext (jwe / cwe).
 */
export type TokenFormatKind = "claims" | "opaque" | "encrypted";

/**
 * A TOTAL record, deliberately, rather than three `includes()` tests.
 *
 * ⚠ `noImplicitReturns` is off repo-wide, so a chain of membership tests lets a
 * NEW format fall silently into whichever branch happens to be last — and the
 * last branch here would treat it as an opaque signed token, i.e. accept it and
 * report an empty claims set. A total record makes that a compile error at the
 * one place the fact belongs.
 */
export const TOKEN_FORMAT_KIND: Record<TokenFormatTag, TokenFormatKind> = {
  jwt: "claims",
  cwt: "claims",
  cwm: "claims",
  jws: "opaque",
  cws: "opaque",
  jwe: "encrypted",
  cwe: "encrypted",
};
