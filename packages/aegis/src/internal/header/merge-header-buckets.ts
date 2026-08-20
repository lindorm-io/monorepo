import type { Dict } from "@lindorm/types";
import type { WireHeaderBuckets, WireTokenHeader } from "../../types/index.js";
import { isProtectedOnly } from "./is-protected-only.js";

/**
 * Merge a token's two WIRE header buckets into the ONE header the DOMAIN tier
 * reports, in the canonical order: start from the unprotected bucket FILTERED to
 * the parameters the header registry permits there, then overwrite with the
 * protected bucket.
 *
 * ⚠ THIS REVERSES A DOCUMENTED RULE, and the filter is why it is still safe. The
 * domain results used to report the two buckets SEPARATELY, on the ground that a
 * parameter nothing covers must not be readable as though the issuer had signed
 * it. That property is preserved here by CONSTRUCTION rather than by making the
 * reader choose: `placement` (`is-protected-only.ts`) decides it, so the only
 * parameters that can enter the domain header from the unauthenticated bucket are
 * the two the registry marks `"either"` — `kid` and
 * `iv`, the COSE routing/AEAD infrastructure RFC 9052 §3.1 puts there precisely
 * because they are not security-critical. Everything a verifier routes, audits or
 * polices a token by — `typ`, `cty`, `oid`, `x5c`, `x5u` — is `"protected"` and is
 * DROPPED here, silently and unconditionally.
 *
 * ⚠ THIS IS A READ-SIDE RULE ABOUT A FOREIGN TOKEN, and it has no write-side twin
 * to mirror: a caller cannot express the shape at all. `header` is the only
 * registered bag a caller can fill and it travels protected, so there is nothing
 * for a write-side refusal to refuse (`build-cose-headers.ts` states the
 * structural argument). `is-protected-only.ts` has exactly one production reader —
 * this one.
 *
 * The protected bucket therefore always wins a collision: it is applied second,
 * so a `kid` in both buckets reports the signed one. What the previous split
 * bought — a reader who could tell the two apart — cost every reader the wire
 * vocabulary of ONE encoding on a surface that speaks neither.
 *
 * ⚠ NOT `Object.assign` and not a spread of the whole bucket: an explicitly
 * `undefined` value is an ABSENT parameter, and copying one would let the
 * protected bucket clobber a legitimate unprotected `kid` with nothing.
 *
 * ⛔ IT TAKES THE TWO TYPED BUCKETS ONLY, by `Pick`, and that is the tier
 * boundary made structural: this merge is the last wire-tier step before
 * `parseTokenHeader` produces `VerifiedToken.header`, and an unregistered
 * parameter has no domain name to be reported under. Widening the parameter to
 * the whole {@link WireHeaderBuckets} would put `unknown` in reach of a future
 * edit here; it is not in reach now.
 */
export const mergeHeaderBuckets = (
  buckets: Pick<WireHeaderBuckets, "protectedHeader" | "unprotectedHeader">,
): WireTokenHeader => {
  const merged: Dict = {};

  for (const [jose, value] of Object.entries(buckets.unprotectedHeader)) {
    if (value === undefined) continue;
    if (isProtectedOnly(jose)) continue;

    merged[jose] = value;
  }

  for (const [jose, value] of Object.entries(buckets.protectedHeader)) {
    if (value === undefined) continue;

    merged[jose] = value;
  }

  return merged as WireTokenHeader;
};
