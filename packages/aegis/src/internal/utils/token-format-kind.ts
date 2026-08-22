import type { ClaimsTokenFormat, TokenFormatTag } from "../../types/index.js";

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
export const TOKEN_FORMAT_KIND = {
  jwt: "claims",
  cwt: "claims",
  cwm: "claims",
  jws: "opaque",
  cws: "opaque",
  jwe: "encrypted",
  cwe: "encrypted",
  // ⚠ `as const satisfies`, never a type ANNOTATION: an annotation widens every
  // cell to `TokenFormatKind` and erases the literals, so `TokenFormatOfKind`
  // below can no longer be derived from this record.
} as const satisfies Record<TokenFormatTag, TokenFormatKind>;

/** The formats of one KIND, derived from the record above. */
export type TokenFormatOfKind<K extends TokenFormatKind> = {
  [F in TokenFormatTag]: (typeof TOKEN_FORMAT_KIND)[F] extends K ? F : never;
}[TokenFormatTag];

/**
 * The kind check as a TYPE GUARD, so asking what a format IS also narrows it.
 * `TOKEN_FORMAT_KIND[format] === "encrypted"` is a value comparison that narrows
 * nothing, and every caller then casts back to the subset it just proved.
 */
export const isTokenFormatOfKind = <K extends TokenFormatKind>(
  format: TokenFormatTag,
  kind: K,
): format is TokenFormatOfKind<K> => TOKEN_FORMAT_KIND[format] === kind;

/**
 * ⭐ THE PUBLIC `ClaimsTokenFormat` AND THIS RECORD CANNOT DISAGREE.
 *
 * `ClaimsTokenFormat` is spelled as an `Extract<TokenFormat, …>` in
 * `types/domain/token-format.ts` because a public type may not import a runtime
 * value out of `internal/`. That leaves two hand-written lists of one fact, and
 * widening the public one with `"cws"` otherwise typechecks clean and routes an
 * OPAQUE format into `wire.signClaims`, handing a COSE_Sign1 over arbitrary bytes
 * to the claims codec.
 *
 * The assignment below is the check: a TYPE-level equality in both directions, so
 * adding a format to one list and not the other stops the build here.
 */
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

const _claimsFormatsAgree: MutuallyAssignable<
  ClaimsTokenFormat,
  TokenFormatOfKind<"claims">
> = true;

void _claimsFormatsAgree;
