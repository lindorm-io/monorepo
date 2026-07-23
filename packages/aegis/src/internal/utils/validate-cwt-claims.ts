import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type { DomainAssert, VerifyOptions } from "../../types/index.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { validate } from "./validate.js";

/**
 * Validate a decoded CWT's standard claims exactly as the Aegis JOSE verify half
 * does: `exp` presence policy, then the named identity matchers (iss/aud/sub/…),
 * reusing the JOSE identity builder. The temporal RANGE (exp/nbf/iat with clock
 * tolerance) is checked IN THE KIT now (`CwtKit`/`CwmKit`.verify, Phase 9 R10),
 * so this layer is identity-only — the exact COSE mirror of `verifyJwtToDomain`.
 *
 * The input is the CWT's COSE-name-keyed WIRE (`CoseVerifyResult.wire`). The
 * matcher claims (`exp`/`iss`/`aud`/`sub`/…) share the JOSE names, so the JOSE
 * matchers apply directly — no domain re-keying. The only name-diverging claim
 * (`cti`) is not a matcher claim, so it is irrelevant here. Temporal claims are
 * `Date`s (the codec's "date" kind), so the exp lower-bound compares Date-to-Date.
 */
export const validateCwtClaims = (
  wire: Dict,
  algorithm: KryptosAlgorithm,
  assert: DomainAssert | undefined,
  options: VerifyOptions,
  clockTolerance: number,
): void => {
  const payload = wire;

  // `exp` presence is POLICY (default "required"). Surface a dedicated,
  // self-describing code rather than the generic claims-invalid one.
  if (options.expPresence !== "optional" && payload.exp === undefined) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "cwt_missing_claim_exp",
      title: "CWT Missing Claim Exp",
      details:
        'The CWT has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // The matcher bag is the domain `assert` merged with the three hash-derive
  // inputs lifted from verify OPTIONS — identical to the JOSE half.
  const matchers = omitUndefined({
    ...assert,
    accessToken: options.accessToken,
    authCode: options.authCode,
    authState: options.authState,
  });

  const predicate = createIdentityMatchers(
    algorithm,
    matchers,
    clockTolerance,
    options.expPresence,
    options.currentDate,
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
