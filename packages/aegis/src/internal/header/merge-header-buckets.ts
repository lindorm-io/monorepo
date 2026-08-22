import type { Dict } from "@lindorm/types";
import type { CoseHeaderBuckets, WireTokenHeader } from "../../types/index.js";
import { isProtectedOnly } from "./is-protected-only.js";

/**
 * Merge a token's two WIRE header buckets into the ONE header the DOMAIN tier
 * reports: start from the unprotected bucket FILTERED to the parameters the header
 * registry permits there, then overwrite with the protected bucket.
 *
 * ⚠ A PARAMETER NOTHING COVERS MUST NOT READ AS THOUGH THE ISSUER SIGNED IT. The
 * filter keeps that by CONSTRUCTION: `placement` (`is-protected-only.ts`) decides,
 * so only the parameters the registry marks `"either"` can enter from the
 * unauthenticated bucket — see RFC 9052 §3.1 and the allowlist pinned in
 * `merge-header-buckets.test.ts`. Everything else is DROPPED here, silently.
 *
 * ⚠ A READ-SIDE RULE ABOUT A FOREIGN TOKEN, with no write-side twin: `header` is
 * the only registered bag a caller can fill and it travels protected, so there is
 * nothing for a write-side refusal to refuse (`build-cose-headers.ts`).
 *
 * The protected bucket wins a collision — it is applied second. A reader who needs
 * the two apart reads the KIT result ({@link CoseHeaderBuckets}).
 *
 * ⚠ NOT `Object.assign` and not a whole-bucket spread: an explicitly `undefined`
 * value is an ABSENT parameter, and copying one would let the protected bucket
 * clobber a legitimate unprotected `kid` with nothing.
 *
 * ⛔ IT TAKES THE TWO TYPED BUCKETS ONLY, by `Pick` — widening the parameter to the
 * whole {@link CoseHeaderBuckets} would put `custom` in reach of an edit here.
 */
export const mergeHeaderBuckets = (
  buckets: Pick<CoseHeaderBuckets, "protectedHeader" | "unprotectedHeader">,
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
