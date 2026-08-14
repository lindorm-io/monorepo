import { headerByJose } from "./header-registry.js";

/**
 * Whether a header parameter is INTEGRITY-PROTECTED ONLY — the ONE reader of the
 * header registry's `placement` column, consulted by both directions:
 *
 *   - WRITE (`build-cose-headers.ts`): a parameter this answers `true` for is
 *     REFUSED from the caller's unprotected bag, so aegis never emits it there.
 *   - READ  (`merge-header-buckets.ts`): a parameter this answers `true` for is
 *     IGNORED when it arrives in a foreign token's unprotected bucket, so it can
 *     never reach the domain header as though the issuer had signed it.
 *
 * One datum, both directions. A second list would be a second opinion about the
 * same question, and the day the two disagreed aegis would refuse to write a
 * parameter it was still willing to read.
 *
 * An UNREGISTERED wire name answers `false`, which is not a permission: the
 * write side hands it to `coseByJose`, which refuses it by name
 * (`header_no_cose_label`), and the read side drops it in `parseTokenHeader`,
 * because headers are a closed set. Answering `true` here would only replace
 * those two accurate refusals with a placement error about a parameter that has
 * no placement.
 */
export const isProtectedOnly = (jose: string): boolean =>
  headerByJose(jose)?.placement === "protected";
