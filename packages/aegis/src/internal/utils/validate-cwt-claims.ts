import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { VerifyAssert, VerifyOptions } from "../../types/index.js";
import { coseName } from "../claims/claims-registry.js";
import { coseTyp } from "../cose/cose-typ.js";
import { computeTypHeader } from "./compute-typ-header.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { validate } from "./validate.js";

/**
 * Validate a decoded CWT's standard claims exactly as the Aegis JOSE verify half
 * does: `exp` presence policy, the `tokenType` assertion, then the named
 * identity matchers (iss/aud/sub/…), reusing the JOSE identity builder. The
 * temporal RANGE (exp/nbf/iat with clock tolerance) is checked IN THE KIT now
 * (`CwtKit`/`CwmKit`.verify, Phase 9 R10), so this layer is identity-only — the
 * exact COSE mirror of `verifyJwtToDomain`.
 *
 * The input is the CWT's COSE-name-keyed WIRE (`CoseVerifyResult.wire`), so the
 * predicate is BUILT with the COSE name selector. Most matcher claims
 * (`iss`/`aud`/`sub`/…) spell the same on both wires, but `tokenId` does not —
 * `jti` on JOSE, `cti` here.
 *
 * ⚠ This comment previously claimed `cti` "is not a matcher claim, so it is
 * irrelevant here". It is one: `tokenId` is `keyof DomainClaims` and typechecks.
 * The predicate was built with JOSE names and applied to this COSE-keyed wire, so
 * an exact `tokenId` match rejected a legitimate token and, worse,
 * `{ tokenId: { $exists: false } }` PASSED on a token that carries a `cti` — a
 * replay guard getting a silent yes.
 */
export const validateCwtClaims = ({
  wire,
  typ,
  algorithm,
  assert,
  options,
}: {
  wire: Dict;
  /** The verified COSE `typ` (label 16, RFC 9596) — the CWT's own type header. */
  typ: string | undefined;
  algorithm: KryptosAlgorithm;
  assert: VerifyAssert | undefined;
  options: VerifyOptions;
}): void => {
  const payload = wire;

  // `exp` presence is POLICY (default "required"). Surface a dedicated,
  // self-describing code rather than the generic claims-invalid one. The exp
  // RANGE (and its per-claim skip flags) is checked in the kit, not here.
  if (options.expPresence !== "optional" && payload.exp === undefined) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "cwt_missing_claim_exp",
      title: "CWT Missing Claim Exp",
      details:
        'The CWT has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // `tokenType` asserts the token's TYPE, which COSE keeps in the `typ` header
  // rather than a claim — the same assertion the JOSE half makes, spelled in
  // COSE's vocabulary. Derived through the ONE JOSE→COSE typ mapping (`coseTyp`)
  // that mint stamps with, so the two can never disagree.
  const { tokenType, ...claimMatchers } = assert ?? {};

  if (tokenType !== undefined) {
    const expected = coseTyp({
      presence: "required",
      value: computeTypHeader(tokenType, "jwt"),
    });

    if (typ !== expected) {
      throw new AegisDomainError("Invalid token", {
        code: "cwt_typ_mismatch",
        data: { typ },
        debug: { expected },
        title: "CWT Typ Mismatch",
        details:
          "The COSE typ header does not match the type asserted for this verification.",
      });
    }
  }

  // The wire this predicate is applied to is COSE-name-keyed, so it must be
  // BUILT that way — `cti`, not `jti`.
  const predicate = createIdentityMatchers(
    algorithm,
    omitUndefined(claimMatchers),
    coseName,
  );

  try {
    validate(payload, predicate as never);
  } catch (err) {
    throw new AegisDomainError("Invalid token", {
      code: "cwt_claims_invalid",
      data: { invalid: (err as any).data?.invalid },
      debug: { invalid: (err as any).debug?.invalid },
      title: "CWT Claims Invalid",
      details:
        "One or more claims (such as exp, nbf, iat, or a verifier-supplied claim) failed the validation predicate.",
    });
  }
};
