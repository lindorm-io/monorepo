import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type {
  ParsedDpopProof,
  TokenDelegation,
  VerifyAssert,
  VerifyOptions,
} from "../../types/index.js";
import { coseName, joseName, type NameSelector } from "../claims/claims-registry.js";
import type { DomainClaims } from "./extract-claims.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { validate } from "./validate.js";
import { validateActor } from "./validate-actor.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";

/**
 * The only things that genuinely differ between the two wires at this layer.
 * Everything else in {@link applyVerifyPolicy} is shared code, which is the
 * point: the policy tail used to exist twice, and the COSE copy was missing four
 * of the six steps.
 */
export type VerifyPolicyCodec = {
  /** Which wire spelling the matcher predicate is keyed by (`jti` vs `cti`). */
  nameOf: NameSelector;
  /**
   * Error-code prefix. ⚠ TEMPORARY: the domain surface is due to go wire-neutral
   * with the wire named in `data.format`, at which point this field and every
   * template below it disappear. It exists so unifying the CODE contract stays a
   * separate, reviewable change from unifying the LOGIC.
   */
  prefix: "jwt" | "cwt";
  /**
   * `typPresence` when the caller states none. RFC 8725 §3.11 mandates explicit
   * typing for JOSE; RFC 9596 leaves the COSE `typ` (label 16) optional. This is
   * the one default that legitimately differs per wire — an EXPLICIT value
   * behaves identically on both.
   */
  defaultTypPresence: "required" | "optional";
};

/**
 * The domain policy every claims-bearing verify applies once integrity is
 * established: typ presence, exp presence, the caller's identity matchers, the
 * actor chain, and the DPoP binding.
 *
 * ONE site, both wires. It was two, and the COSE copy ran only exp presence and
 * the matchers — so `typPresence`, `actor`, `dpopProof` and `trustBoundThumbprint`
 * were accepted and silently dropped on every CWT. A caller requiring a DPoP
 * proof on a COSE access token got no proof check at all.
 *
 * Returns the parsed DPoP proof; every other outcome is a throw.
 */
export const applyVerifyPolicy = ({
  wireClaims,
  claims,
  delegation,
  decodedTyp,
  algorithm,
  assert,
  options,
  codec,
  token,
  dpopMaxSkew,
}: {
  /**
   * The WIRE-keyed claim dict the matchers run against, with temporal claims as
   * `Date`s. Both wires produce this; only the key spelling differs, which is
   * what `codec.nameOf` accounts for.
   */
  wireClaims: Dict;
  /** The DOMAIN claims — read for the `cnf` thumbprint the DPoP check binds to. */
  claims: DomainClaims;
  /**
   * The act-chain summary. REQUIRED, not optional: `extractTokenDelegation`
   * always returns one, and making it optional here is what would let the COSE
   * caller keep omitting it — which is exactly the bug (a COSE result reported
   * "not delegated" for a token that was).
   */
  delegation: TokenDelegation;
  /** The token's own type header, already verified. */
  decodedTyp: string | undefined;
  algorithm: KryptosAlgorithm;
  /** The caller's matcher bag, ALREADY less `tokenType` (each wire asserts that itself). */
  assert: VerifyAssert | undefined;
  options: VerifyOptions;
  codec: VerifyPolicyCodec;
  token: string;
  dpopMaxSkew: number;
}): { dpop: ParsedDpopProof | undefined } => {
  const typPresence = options.typPresence ?? codec.defaultTypPresence;

  if (typPresence !== "optional" && decodedTyp === undefined) {
    throw new AegisDomainError("Invalid token", {
      code: `${codec.prefix}_invalid_typ`,
      data: { typ: decodedTyp },
      title: "Invalid Typ",
      details:
        "The token carries no type header, but this verification requires explicit typing.",
    });
  }

  // `exp` PRESENCE is policy (default "required"), surfaced under its own code
  // ahead of the generic matcher pass. The exp RANGE (with clock tolerance) was
  // already checked by the kit.
  if (options.expPresence !== "optional" && wireClaims.exp === undefined) {
    throw new AegisDomainError("Missing claim: exp", {
      code: `${codec.prefix}_missing_claim_exp`,
      title: "Missing Claim Exp",
      details:
        'The token has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // Built OUTSIDE the try: a matcher the builder REFUSES (an unknown key, a hash
  // source it cannot hash) is a caller mistake with its own message, and folding
  // it into the claims-invalid error reported "claims invalid" with an EMPTY
  // invalid list — the failure that names nothing.
  const predicate = createIdentityMatchers(
    algorithm,
    omitUndefined(assert ?? {}),
    codec.nameOf,
  );

  try {
    validate(wireClaims, predicate as never);
  } catch (err) {
    throw new AegisDomainError("Invalid token", {
      code: `${codec.prefix}_claims_invalid`,
      data: { invalid: (err as any).data?.invalid },
      debug: { invalid: (err as any).debug?.invalid },
      title: "Claims Invalid",
      details:
        "One or more claims (such as a verifier-supplied claim) failed the validation predicate.",
    });
  }

  const actorError = validateActor(delegation, options.actor);

  if (actorError) {
    throw new AegisDomainError(actorError.message, {
      code: `${codec.prefix}_actor_not_allowed`,
      debug: actorError.debug,
      title: "Actor Not Allowed",
      details:
        "The token's act delegation chain does not satisfy the expected actor supplied to verify.",
    });
  }

  const boundThumbprint = claims.confirmation?.thumbprint;

  if (options.dpopProof !== undefined) {
    if (!boundThumbprint) {
      throw new AegisDomainError(
        "Invalid token: DPoP proof provided but token is not bound",
        {
          code: `${codec.prefix}_dpop_token_not_bound`,
          debug: { confirmation: claims.confirmation },
          title: "DPoP Token Not Bound",
          details:
            "A DPoP proof was supplied but the token carries no cnf.jkt thumbprint, so it cannot be DPoP-bound.",
        },
      );
    }

    return {
      dpop: verifyDpopProof({
        proof: options.dpopProof,
        accessToken: token,
        expectedThumbprint: boundThumbprint,
        dpopMaxSkew,
      }),
    };
  }

  // RFC 9449 defines only the JWT proof form, but the PROOF's wire is
  // independent of the bound token's: a `cnf.jkt` in a CWT binds exactly as it
  // does in a JWT, so the refusal applies on both.
  if (boundThumbprint && !options.trustBoundThumbprint) {
    throw new AegisDomainError(
      "Invalid token: token is DPoP-bound but no DPoP proof was provided",
      {
        code: `${codec.prefix}_dpop_proof_required`,
        title: "DPoP Proof Required",
        details:
          "The token carries a cnf.jkt thumbprint, so a matching DPoP proof must be supplied unless trustBoundThumbprint is set.",
      },
    );
  }

  return { dpop: undefined };
};

/** RFC 8725 §3.11 — JOSE mandates explicit typing. */
export const JOSE_VERIFY_CODEC: VerifyPolicyCodec = {
  nameOf: joseName,
  prefix: "jwt",
  defaultTypPresence: "required",
};

/** RFC 9596 — the COSE `typ` header is optional. */
export const COSE_VERIFY_CODEC: VerifyPolicyCodec = {
  nameOf: coseName,
  prefix: "cwt",
  defaultTypPresence: "optional",
};
