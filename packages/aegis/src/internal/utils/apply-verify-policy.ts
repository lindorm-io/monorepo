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
import { matcherWireName } from "./matcher-wire-name.js";
import { isClaimOmitted } from "./rules/is-claim-omitted.js";
import { isClaimSatisfied } from "./rules/is-claim-satisfied.js";
import { validate } from "./validate.js";
import { validateActor } from "./validate-actor.js";
import type { ActorValidationError } from "./validate-actor.js";
import { verifyDpopProof } from "./verify-dpop-proof.js";

/**
 * ⚠ The two actor refusals send a reader to different places, so they must not
 * share a code: `actor_not_allowed` is a fact about the TOKEN, while
 * `actor_policy_invalid` is a fact about the OPTION the caller passed, and an
 * operator handed the first for the second reads a delegation chain that is
 * fine. Pinned by the `code` on the scenario rows
 * `an-actor-allowlist-that-constrains-nothing-is-refused` and
 * `an-actor-allowlist-stated-as-a-denial-refuses-a-token-that-names-no-actor`.
 */
const ACTOR_REFUSALS: Record<
  ActorValidationError["code"],
  { title: string; details: string }
> = {
  actor_not_allowed: {
    title: "Actor Not Allowed",
    details:
      "The token's act delegation chain does not satisfy the expected actor supplied to verify.",
  },
  actor_policy_invalid: {
    title: "Actor Policy Invalid",
    details:
      "The allowedActor condition supplied to verify states nothing, or contains a sub-condition that does, so no actor this verifier can test against it can fail it.",
  },
};

/**
 * The domain policy every claims-bearing verify applies once integrity is
 * established: typ presence, exp presence, the caller's identity matchers, the
 * actor chain, and the DPoP binding.
 *
 * ⚠ ONE site, both wires. A per-wire copy silently drops whichever of
 * `typPresence`, `actor`, `dpopProof` and `trustBoundThumbprint` it forgets, and
 * the caller hears nothing.
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
   * The act-chain summary. ⚠ REQUIRED, not optional: `extractTokenDelegation`
   * always returns one, and an optional field here lets a caller omit it, so the
   * result reports "not delegated" for a token that is.
   */
  delegation: TokenDelegation;
  /** The token's own type header, already verified. */
  decodedTyp: string | undefined;
  algorithm: KryptosAlgorithm;
  /** The caller's matcher bag, ALREADY less `tokenType` (each wire asserts that itself). */
  assert: VerifyAssert | undefined;
  options: VerifyOptions;
  /**
   * The wire the token actually is. ⚠ DIAGNOSTIC, never a branch: every code below
   * is wire-neutral, so a wire-prefixed code would report a CWT failure as a JWT
   * problem.
   */
  format: TokenFormatTag;
  /** Which wire spelling the matcher predicate is keyed by (`jti` vs `cti`). */
  nameOf: NameSelector;
  /**
   * `typPresence` when the caller states none. The JOSE default of `"required"` is
   * aegis POLICY, not a mandate — RFC 8725 §3.11, RFC 9596. An EXPLICIT value
   * behaves identically on both wires.
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
  // ahead of the generic matcher pass. The exp RANGE was already checked by the
  // kit. ⚠ `wireClaims` is the MATCHER bag, not the raw wire — `withJoseDates`
  // has lifted a falsy `exp` to `undefined` and the COSE codec decoded its
  // temporal claims — so this gate and the profile floor's see the same
  // `Date | undefined`.
  if (options.expPresence !== "optional" && !isClaimSatisfied(wireClaims.exp)) {
    throw new AegisDomainError("Missing claim: exp", {
      code: "missing_claim_exp",
      data: { format },
      title: "Missing Claim Exp",
      details:
        'The token has no exp claim, but exp is required for this verification (expPresence is not "optional").',
    });
  }

  // ⚠ Built OUTSIDE the try: a matcher the builder REFUSES (an unknown key, a
  // hash source it cannot hash) is a caller mistake with its own message. Folded
  // into the try it becomes `claims_invalid` with an EMPTY invalid list. A shape
  // only the MATCHER refuses (an empty `$and` / `$or`, a `$not` that is not an
  // object) is raised inside the try and surfaces as `claims_invalid` with no
  // invalid list. pinned: scenario row
  // `an-empty-disjunction-is-refused-as-a-claims-failure`.
  // ⚠ `omitUndefined` HERE, not only inside the recursion: the predicate and
  // `domainByWire` below must read ONE bag, and an undefined raw source beside
  // its digest claim would otherwise reach the map and claim the wire name the
  // digest compiled to. pinned: scenario row
  // `a-matcher-left-undefined-is-never-the-one-a-refusal-names`.
  const matchers = omitUndefined(assert ?? {});

  const predicate = createIdentityMatchers(algorithm, matchers, nameOf);

  /**
   * The caller's own vocabulary, keyed by the wire name each matcher compiled to.
   * Built from the TOP-LEVEL keys of the caller's bag rather than the registry,
   * so it needs no jose/cose branch of its own. `validate` names top-level
   * entries only, so nothing nested is ever looked up here.
   */
  const domainByWire = new Map<string, string>(
    Object.keys(matchers).map((key) => [matcherWireName(key, nameOf) ?? key, key]),
  );

  try {
    validate(wireClaims, predicate as never, AegisDomainError, "claims_invalid");
  } catch (err) {
    const invalid = (err as any).data?.invalid as Array<string> | undefined;

    throw new AegisDomainError("Invalid token", {
      code: "claims_invalid",
      // `data` speaks the CALLER's vocabulary — pylon's HTTP error handler puts it
      // straight in the response body, and the caller stated `tokenId`, which the
      // wire spells `jti` on JOSE and `cti` on COSE. Pinned by the scenario row
      // `a-domain-refusal-names-the-claims-in-the-vocabulary-the-caller-used`.
      // A root operator (`$and` / `$or` / `$not`) names no claim, so it has no
      // wire name and maps to itself in `domainByWire`; every claim key
      // `validate` reports is in the map because `createIdentityMatchers`
      // throws on one it cannot map. The `?? key` is the Map's `| undefined`.
      data: {
        invalid: invalid?.map((key) => domainByWire.get(key) ?? key),
        format,
      },
      // `debug` stays WIRE-spelled and carries the values: it says what is on the
      // token, which is what a log reader compares the token itself against.
      debug: { invalid: (err as any).debug?.invalid },
      title: "Claims Invalid",
      details:
        "One or more claims (such as a verifier-supplied claim) failed the validation predicate.",
    });
  }

  const actorError = validateActor(delegation, options.actor);

  if (actorError) {
    const refusal = ACTOR_REFUSALS[actorError.code];

    throw new AegisDomainError(actorError.message, {
      code: actorError.code,
      data: { format },
      debug: actorError.debug,
      title: refusal.title,
      details: refusal.details,
    });
  }

  /**
   * Whether the token declares a sender constraint — the VOCABULARY question (did
   * the issuer name `cnf.jkt`).
   *
   * ⚠ NOT truthiness: `""` is a string AND falsy, so a truthy test accepts
   * `cnf: { jkt: "" }` as a plain bearer token on the unvouched path, and refuses
   * it `dpop_token_not_bound` — a false statement about a declared-bound token —
   * on the proof path.
   *
   * ⚠⚠ `cnf` IS THE ONE CLAIM EXEMPT FROM THE PACKAGE'S NULL-IS-ABSENCE RULE
   * (`internal/claims/is-not-stated.ts`). Without the exemption a null `jkt` is
   * erased in `domainToWire` before the COSE fail-closed guard sees it (that guard
   * asks `cnf[member] !== undefined`, `internal/cose/cose-key.ts`), and
   * `mint("cwt", { thumbprint: null, keyId })` mints a CWT that verifies with no
   * proof, byte-identical to a legitimate key-id binding — where
   * `{ thumbprint: JKT, keyId }` refuses `cose_cnf_unsupported`. RFC 9449 §6.1.
   *
   * ⛔ WHAT THIS GATE DOES NOT SEE: `internal/claims/translate.ts` refuses an
   * UNREADABLE confirmation, not an UNBOUND one. A `cnf` carrying `jwk`/`kid` and
   * no `jkt` arrives with `boundThumbprint` undefined and counts as declaring no
   * sender constraint. `Aegis.toDomain` is NOT signature-gated (pylon calls it on
   * an introspection response body), so "only an issuer could have written this"
   * is not an argument available at every door.
   */
  const boundThumbprint = claims.confirmation?.thumbprint;

  /**
   * ⭐ NAMED, BUT NOT SATISFIED — one check, ahead of all three DPoP branches.
   * A confirmation naming nothing is a declaration that cannot be honoured, so it
   * is refused rather than downgraded to bearer semantics. RFC 7800 §3.
   *
   * ⚠⚠ IT MUST STAY AHEAD OF THE BRANCHES rather than be repeated inside them.
   * `trustBoundThumbprint` substitutes for the PROOF, never for the binding the
   * proof was checked against, so a copy inside the branches leaves
   * `cnf: { jkt: "" }` verifying as a bearer token on the vouched path; and on the
   * proof path the empty thumbprint reaches `verifyDpopProof` and is refused
   * `dpop_thumbprint_mismatch`, blaming the presenter's key for the token's
   * confirmation.
   *
   * ⚠ TWO VALUES, ONE PREDICATE: `confirmation` answers for `cnf: {}` and
   * `thumbprint` for `cnf: { jkt: "" }`. `isClaimOmitted` is vocabulary presence,
   * `isClaimSatisfied` is whether there is a value to bite on; the gap between
   * them IS this verdict.
   *
   * ⚠ It judges no other `cnf` member — `jkt` is the only member aegis gates on,
   * so an empty `kid`/`x5t#S256`/`jku`/`jwk` slips past no check. If aegis gates
   * on a second member it joins this verdict, and the error's `details` widens.
   */
  const namedButUnsatisfied = (value: unknown): boolean =>
    !isClaimOmitted(value) && !isClaimSatisfied(value);

  /**
   * WHICH of the two values was named and unsatisfied — `cnf` for a confirmation
   * with no member, `cnf.jkt` for one whose thumbprint is empty.
   *
   * ⚠⚠ IT IS IN `data` because `format` alone cannot discriminate this refusal
   * from `dpop_token_not_bound`, which fires on the SAME token when a proof is
   * supplied and stamps an identical `data: { format }`. A scenario row pinning
   * `format` alone goes green against the wrong refusal.
   */
  const unsatisfied = namedButUnsatisfied(claims.confirmation)
    ? "cnf"
    : namedButUnsatisfied(boundThumbprint)
      ? "cnf.jkt"
      : undefined;

  if (unsatisfied !== undefined) {
    throw new AegisDomainError("Invalid token: the confirmation binds no key", {
      code: "confirmation_binds_no_key",
      data: { format, member: unsatisfied },
      debug: { confirmation: claims.confirmation },
      title: "Confirmation Binds No Key",
      details:
        "The token carries a confirmation that is empty, or one whose thumbprint (cnf.jkt) is present but empty. A confirmation declares that the presenter holds a particular key, so one naming nothing cannot be honoured and is refused on every path, including the ones where a caller vouches that the proof was checked upstream. Only those two shapes are judged here: the thumbprint is the one confirmation member this verifier acts on, so an empty value in any other member passes no gate it could otherwise have failed. RFC 7800 §3.1.",
    });
  }

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

  // The PROOF's wire is independent of the bound token's: a `cnf.jkt` in a CWT
  // binds exactly as it does in a JWT, so the refusal applies on both. RFC 9449.
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
