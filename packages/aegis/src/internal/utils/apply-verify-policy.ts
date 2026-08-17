import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { AegisDomainError } from "../../errors/index.js";
import type {
  ParsedDpopProof,
  TokenDelegation,
  TokenFormatTag,
  VerifyAssert,
  VerifyOptions,
} from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import type { DomainClaims } from "../../types/claims/domain/domain-claims.js";
import { createIdentityMatchers } from "./jwt-identity-matchers.js";
import { isClaimOmitted } from "./rules/is-claim-omitted.js";
import { isClaimSatisfied } from "./rules/is-claim-satisfied.js";
import { validate } from "./validate.js";
import { validateActor } from "./validate-actor.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";

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
  format,
  nameOf,
  defaultTypPresence,
  token,
  dpopMaxSkew,
}: {
  /**
   * The WIRE-keyed claim dict the matchers run against, with temporal claims as
   * `Date`s. Both wires produce this; only the key spelling differs, which is
   * what `nameOf` accounts for.
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
  /**
   * The wire the token actually is. It is DIAGNOSTIC, never a branch: every code
   * below is wire-neutral, and this is what a reader needs to know which encoding
   * produced the failure. The domain layer used to stamp a `jwt_` prefix on both
   * wires, so a CWT's temporal failure reported itself as a JWT problem.
   */
  format: TokenFormatTag;
  /** Which wire spelling the matcher predicate is keyed by (`jti` vs `cti`). */
  nameOf: NameSelector;
  /**
   * `typPresence` when the caller states none. JOSE defaults to `"required"` as
   * aegis POLICY, modelled on RFC 8725 §3.11 — which RECOMMENDS explicit typing,
   * not mandates it; RFC 9596 genuinely leaves the COSE `typ` (label 16)
   * optional. An EXPLICIT value behaves identically on both.
   */
  defaultTypPresence: "required" | "optional";
  token: string;
  dpopMaxSkew: number;
}): { dpop: ParsedDpopProof | undefined } => {
  const typPresence = options.typPresence ?? defaultTypPresence;

  if (typPresence !== "optional" && decodedTyp === undefined) {
    throw new AegisDomainError("Invalid token", {
      // NOT `invalid_typ`: the kits use that name for the OPPOSITE condition — a
      // typ that is PRESENT and wrong. This is the absence.
      code: "typ_required",
      data: { typ: decodedTyp, format },
      title: "Typ Required",
      details:
        "The token carries no type header, but this verification requires explicit typing.",
    });
  }

  // `exp` PRESENCE is policy (default "required"), surfaced under its own code
  // ahead of the generic matcher pass. The exp RANGE (with clock tolerance) was
  // already checked by the kit.
  // ⚠ `wireClaims` is the MATCHER bag, not the raw wire: `withJoseDates` has
  // already lifted a falsy `exp` to `undefined` on JOSE, and the COSE claim
  // codec decodes temporal claims inside the kit. So this and the profile
  // floor's own gate see the same `Date | undefined`, and the predicate is the
  // notion named once rather than a coverage difference.
  if (options.expPresence !== "optional" && !isClaimSatisfied(wireClaims.exp)) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "missing_claim_exp",
      data: { format },
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
    nameOf,
  );

  try {
    validate(wireClaims, predicate as never, AegisDomainError, "claims_invalid");
  } catch (err) {
    throw new AegisDomainError("Invalid token", {
      code: "claims_invalid",
      data: { invalid: (err as any).data?.invalid, format },
      debug: { invalid: (err as any).debug?.invalid },
      title: "Claims Invalid",
      details:
        "One or more claims (such as a verifier-supplied claim) failed the validation predicate.",
    });
  }

  const actorError = validateActor(delegation, options.actor);

  if (actorError) {
    throw new AegisDomainError(actorError.message, {
      code: "actor_not_allowed",
      data: { format },
      debug: actorError.debug,
      title: "Actor Not Allowed",
      details:
        "The token's act delegation chain does not satisfy the expected actor supplied to verify.",
    });
  }

  /**
   * Whether the token declares a sender constraint — the VOCABULARY question
   * (did the issuer name `cnf.jkt`), replacing the truthiness test that stood at
   * both sites below.
   *
   * ⚠ NOT a spelling change. `""` is a string AND falsy, which is exactly where
   * truthiness and `=== undefined` part company, so both outcomes moved — for
   * the better, and measured through the public `verify` door:
   *   - no proof, no vouch: `cnf: { jkt: "" }` was ACCEPTED as a plain bearer
   *     token, and is now refused `dpop_proof_required`;
   *   - with a well-formed proof: it was refused `dpop_token_not_bound`, a false
   *     statement about a token that IS declared bound, and now reaches the
   *     comparison and is refused `dpop_thumbprint_mismatch`.
   *
   * ⚠ WHAT IS STILL OPEN, and it is a filed defect rather than an oversight:
   * `trustBoundThumbprint: true` accepts `jkt: ""` (it short-circuits the only
   * refusal that fires), and EVERY non-string blanking form — `null`, `42`, `{}`,
   * or a `cnf` that is not an object — is erased to `undefined` by
   * `toConfirmation` (`internal/claims/translate.ts`) before this gate can see
   * that a binding was stated, so all of them are accepted as bearer tokens on
   * every path. Closing that is a decision about what a malformed wire `cnf`
   * MEANS — public-surface semantics, recorded with its measurements in the
   * project's open items. Do not close it here without that decision.
   */
  const boundThumbprint = claims.confirmation?.thumbprint;

  if (options.dpopProof !== undefined) {
    if (isClaimOmitted(boundThumbprint)) {
      throw new AegisDomainError(
        "Invalid token: DPoP proof provided but token is not bound",
        {
          code: "dpop_token_not_bound",
          data: { format },
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
  if (isClaimOmitted(boundThumbprint)) return { dpop: undefined };

  if (!options.trustBoundThumbprint) {
    throw new AegisDomainError(
      "Invalid token: token is DPoP-bound but no DPoP proof was provided",
      {
        code: "dpop_proof_required",
        data: { format },
        title: "DPoP Proof Required",
        details:
          "The token carries a cnf.jkt thumbprint, so a matching DPoP proof must be supplied unless trustBoundThumbprint is set.",
      },
    );
  }

  return { dpop: undefined };
};
