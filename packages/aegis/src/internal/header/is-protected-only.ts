import { headerByJose } from "./header-registry.js";

/**
 * Whether a header parameter is INTEGRITY-PROTECTED ONLY — the ONE reader of the
 * header registry's `placement` column.
 *
 * READ (`merge-header-buckets.ts`): a parameter this answers `true` for is
 * IGNORED when it arrives in a FOREIGN token's unprotected bucket, so it can
 * never reach the domain header as though the issuer had signed it. That is the
 * live consumer, and it is a read-side rule about somebody else's token.
 *
 * ⚠ THE WRITE SIDE NEEDS NO SUCH RULE, because it cannot express the shape.
 * `WireProtectedHeader` is the only registered bag a caller can fill, and it
 * travels protected; the unprotected bucket takes the kit's own `kid`/`iv` plus
 * the caller's `custom.unprotected`, which is unregistered by construction
 * (`build-cose-headers.ts`, `build-custom-header.ts`). Restoring a write-side
 * placement refusal would be a rule guarding a state the types make unwritable.
 *
 * An UNREGISTERED wire name answers `false`, which is not a permission: an
 * unregistered param has no registry row and so no placement, and the answer says
 * only that this column has nothing to say about it.
 */
export const isProtectedOnly = (jose: string): boolean =>
  headerByJose(jose)?.placement === "protected";
