import type { CoseError } from "../../errors/index.js";
import { coseByJose } from "../header/header-registry.js";
import type { CoseLabel } from "./cose-label.js";

/** The COSE integer label for the `kid` header parameter (RFC 9052 §3.1). */
const KID_LABEL = coseByJose("kid");

/**
 * Refuse a signed COSE token that states `kid` in BOTH header buckets, on the
 * structural `cose_duplicate_kid` verdict.
 *
 * ⚠ AEGIS POLICY, not a specification requirement (RFC 9052 §3). The mint refuses
 * the same shape as `cose_duplicate_header` (`build-cose-headers.ts`), so no
 * aegis-written token can reach this.
 *
 * ⚠ PRESENCE, NOT DISAGREEMENT — two EQUAL values are refused too. A producer
 * that states the routing hint twice has already left the reader choosing, and
 * the unprotected copy is one whoever last held the token can rewrite.
 *
 * ⚠ CALLED FROM TWO DOORS, the way `require-bstr.ts` is called from every slot
 * site: `splitSigned` opens every signed structure, but `decodeCwt` resolves the
 * verification key BEFORE any kit exists (`internal/wire/cose-token-wire.ts`,
 * `internal/utils/raw-verify-cwt.ts`), so a guard at one door alone lets the
 * other answer a key refusal for a malformed token.
 *
 * ⚠ It judges the LABEL and never the value. The unprotected slot is a
 * stranger's CBOR — a bucket this reader cannot index states no `kid`.
 */
export const assertKidOneBucket = ({
  protectedMap,
  unprotected,
  error,
}: {
  protectedMap: Map<CoseLabel, unknown>;
  /** The unprotected slot AS CBOR DECODED IT — narrowed here, never cast. */
  unprotected: unknown;
  error: typeof CoseError;
}): void => {
  if (!protectedMap.has(KID_LABEL)) return;
  if (!(unprotected instanceof Map)) return;
  if (!unprotected.has(KID_LABEL)) return;

  throw new error("Key identifier stated in both header buckets", {
    code: "cose_duplicate_kid",
    data: { parameter: "kid" },
    title: "COSE Duplicate Key Identifier",
    details:
      "A key identifier may live in the protected or the unprotected bucket, not both; a token stating one in each states two hints and leaves the reader to choose which key its issuer named.",
  });
};
