import { isNull, isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type {
  StructuredFormat,
  StructuredVerifiedToken,
  TokenFormat,
  VerifiedToken,
} from "../types/index.js";

/**
 * The runtime twin of {@link StructuredFormat}, as a RECORD rather than an array:
 * `Record<StructuredFormat, true>` demands every member (dropping one fails to
 * compile) and refuses an extra, so the union and this table cannot drift apart.
 * An array would only catch the extra.
 */
const STRUCTURED: Record<StructuredFormat, true> = { jwt: true, cwt: true, cwm: true };

/**
 * ⚠ `Object.hasOwn`, never `in`. The table is a plain object literal and the key
 * comes off a CALLER-SUPPLIED token — this guard narrows a value handed in from
 * outside, so `{ format: "constructor" }` resolved through `Object.prototype`
 * and narrowed to a claims-bearing token that carries no claims. `in` on a
 * caller-influenced key is a BANNED construct in this package.
 */
const isStructuredFormat = (format: TokenFormat): format is StructuredFormat =>
  Object.hasOwn(STRUCTURED, format);

/**
 * Does this verified token carry a readable CLAIMS layer?
 *
 * `VerifiedToken.format` is the token's OWN kind, of which only `jws`/`cws` are
 * genuinely claimless (`claims`/`custom` are `{}` by contract). So the widespread
 * `format === "jwt"` shorthand still discards `cwt`/`cwm` — claims-bearing COSE
 * (COSE_Sign1 / COSE_Mac0) — which is what this guard is for.
 *
 * ⚠ AN ENCRYPTED TOKEN NEEDS NO SPECIAL CASE. An encrypted id_token verifies to
 * `{ format: "jwt", wrapper: "jwe" }`, so it answers the same test as a plain
 * one: `wrapper` carries the envelope and never changes what the token IS.
 *
 * Nullish input is FALSE rather than a caller's problem: the check this replaces
 * is `if (!token || token.format !== "jwt")`, and collapsing both halves into one
 * guard is the point. A `jws`/`cws` is false whether or not it was wrapped — the
 * plaintext is opaque either way.
 *
 * ⚠ Not to be confused with `isClaimsBearingToken`, which asks the same question
 * of an UNVERIFIED wire STRING (should this be verified locally or introspected?).
 * This one narrows a result `verify` has already returned.
 */
export const isStructuredToken = <C extends Dict = Dict>(
  token: VerifiedToken<C> | null | undefined,
): token is StructuredVerifiedToken<C> => {
  if (isNull(token) || isUndefined(token)) return false;

  return isStructuredFormat(token.format);
};
