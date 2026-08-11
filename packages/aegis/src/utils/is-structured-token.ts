import { isNull, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type {
  StructuredFormat,
  StructuredVerifiedToken,
  TokenFormatTag,
  VerifiedToken,
} from "../types/index.js";

/**
 * The runtime twin of {@link StructuredFormat}, as a RECORD rather than an array:
 * `Record<StructuredFormat, true>` demands every member (dropping one fails to
 * compile) and refuses an extra, so the union and this table cannot drift apart.
 * An array would only catch the extra.
 */
const STRUCTURED: Record<StructuredFormat, true> = { jwt: true, cwt: true, cwm: true };

/** The encrypting outers — the only formats that ever carry an `inner`. */
const ENCRYPTING: Record<"jwe" | "cwe", true> = { jwe: true, cwe: true };

const isStructuredFormat = (
  format: TokenFormatTag | undefined,
): format is StructuredFormat => !isUndefined(format) && format in STRUCTURED;

/**
 * Does this verified token carry a readable CLAIMS layer?
 *
 * `VerifiedToken.format` is a seven-member union, of which only `jws`/`cws` are
 * genuinely claimless (`claims`/`custom` are `{}` by contract). Everything else
 * has claims — so the widespread `format === "jwt"` shorthand silently discards
 * two whole categories of valid credential:
 *
 * - `cwt`/`cwm` — claims-bearing COSE (COSE_Sign1 / COSE_Mac0);
 * - `jwe`/`cwe` that wrapped a structured inner. `verify` decrypts such a token
 *   and re-verifies its signed inner, returning the inner's fully-populated
 *   `claims`/`custom` with only the OUTER tag reading `jwe`/`cwe` and the inner
 *   format under `inner`. An encrypted id_token is precisely this, and a
 *   `format === "jwt"` check drops it.
 *
 * Nullish input is FALSE rather than a caller's problem: the check this replaces
 * is `if (!token || token.format !== "jwt")`, and collapsing both halves into one
 * guard is the point. A `jws`/`cws` is false, as is an encrypting outer that
 * wrapped one — the plaintext is opaque either way.
 *
 * ⚠ Not to be confused with `isClaimsBearingToken`, which asks the same question
 * of an UNVERIFIED wire STRING (should this be verified locally or introspected?).
 * This one narrows a result `verify` has already returned.
 */
export const isStructuredToken = <C extends Dict = Dict>(
  token: VerifiedToken<C> | null | undefined,
): token is StructuredVerifiedToken<C> => {
  if (isNull(token) || isUndefined(token)) return false;

  if (isStructuredFormat(token.format)) return true;

  // `inner` is only meaningful under an encrypting outer. Checking the outer too
  // means a hand-built `jws` carrying a stray `inner` stays false, rather than
  // the guard trusting a field that format never sets.
  return token.format in ENCRYPTING && isStructuredFormat(token.inner);
};
