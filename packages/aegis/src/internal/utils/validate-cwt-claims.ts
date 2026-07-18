import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import type { VerifyJwtOptions } from "../../types/index.js";
import { specByDomain } from "../claims/registry.js";
import { createJwtVerify } from "./jwt-verify.js";
import { validate } from "./validate.js";

// Re-key the DOMAIN-keyed CWT claims to their JOSE names so the SAME matcher the
// JOSE path builds (createJwtVerify) applies unchanged. Temporal claims decode
// to `Date`s (the "date" value kind), exactly as JwtKit.verify's `withDates`
// carries them, so the range predicates compare Date-to-Date either way.
const toJoseKeyed = (claims: Dict): Dict => {
  const out: Dict = {};
  for (const [domain, value] of Object.entries(claims)) {
    const spec = specByDomain(domain);
    out[spec ? spec.jose : domain] = value;
  }
  return out;
};

/**
 * Validate a decoded CWT's standard claims exactly as `jwt.verify` validates a
 * JWT: `exp` presence policy, then the range checks (exp/nbf/iat with clock
 * tolerance) and any verifier-supplied claim matchers (iss/aud/sub/…), reusing
 * the JOSE verify predicate on the re-keyed claim map.
 */
export const validateCwtClaims = (
  claims: Dict,
  algorithm: KryptosAlgorithm,
  verify: VerifyJwtOptions,
  clockTolerance: number,
): void => {
  const payload = toJoseKeyed(claims);

  // `exp` presence is POLICY (default "required"). Surface a dedicated,
  // self-describing code rather than the generic claims-invalid one.
  if (verify.expPresence !== "optional" && payload.exp === undefined) {
    throw new AegisError("Missing claim: exp", {
      code: "cwt_missing_claim_exp",
      title: "CWT Missing Claim Exp",
      details:
        'The CWT has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  const predicate = createJwtVerify(algorithm, verify, clockTolerance);

  try {
    validate(payload, predicate);
  } catch (err) {
    throw new AegisError("Invalid token", {
      code: "cwt_claims_invalid",
      data: { invalid: (err as any).data?.invalid },
      debug: { invalid: (err as any).debug?.invalid },
      title: "CWT Claims Invalid",
      details:
        "One or more claims (such as exp, nbf, iat, or a verifier-supplied claim) failed the validation predicate.",
    });
  }
};
