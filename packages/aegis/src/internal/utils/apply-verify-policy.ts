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
   * ⚠ THE OTHER BLANKING FORMS ARE CLOSED ELSEWHERE, and the split is the point.
   * `42`, `{}` and a `cnf` that is not an object at all used to be erased to
   * `undefined` by the confirmation decoder before this gate could see that a
   * binding had been stated, so every one of them verified as a plain bearer
   * token. They are REFUSED AT THE READ now — a member whose value contradicts
   * its declared shape is not a member this package may drop, and neither is a
   * `cnf` that is not an object (`internal/claims/translate.ts`) — so what
   * reaches this gate is a confirmation that was READABLE. Whether it BINDS
   * anything is the question below.
   *
   * ⚠⚠ `null` IS STILL IN THAT LIST, AND `cnf` IS THE ONE CLAIM EXEMPT FROM THE
   * PACKAGE'S NULL-IS-ABSENCE RULE (`internal/claims/is-not-stated.ts`). The
   * exemption was earned: with `cnf` taking the carve-out, a null `jkt` was erased
   * in `domainToWire` before the COSE fail-closed guard could see it — the guard
   * asks `cnf[member] !== undefined` (`internal/cose/cose-key.ts`) — and
   * `mint("cwt", { thumbprint: null, keyId })` MINTED a CWT that verified with no
   * proof, byte-identical to a legitimate key-id binding, where
   * `{ thumbprint: JKT, keyId }` refuses `cose_cnf_unsupported`. RFC 7800 §3.1
   * §6.1 types the member by MUST — the `jkt` value "MUST be the base64url
   * encoding (as defined in [RFC7515]) of the JWK SHA-256 Thumbprint" — so a null
   * one contradicts the declaration.
   *
   * ⛔ WHAT THIS GATE STILL DOES NOT SEE, stated because the sentence that stood
   * here claimed the read path was safe by construction: `internal/claims/translate.ts`
   * refuses an UNREADABLE confirmation, not an UNBOUND one. A `cnf` carrying
   * `jwk`/`kid` and no `jkt` reaches here with `boundThumbprint` undefined and is
   * treated as declaring no sender constraint — long-standing, and correct for an
   * issuer that wrote it, but note that `Aegis.toDomain` is NOT signature-gated
   * (`classes/Aegis.ts` documents it as the claim door, and pylon calls it on an
   * introspection response body), so "only an issuer could have written this" is
   * not an argument available at every door.
   */
  const boundThumbprint = claims.confirmation?.thumbprint;

  /**
   * ⭐⭐ NAMED, BUT NOT SATISFIED — ONE CHECK, AHEAD OF ALL THREE DPoP BRANCHES.
   *
   * RFC 7800 §3: "By including a 'cnf' (confirmation) claim in a JWT, the issuer
   * of the JWT declares that the presenter possesses a particular key and that
   * the recipient can cryptographically confirm that the presenter has possession
   * of that key." So a verifier deciding whether a token is bound reads whether
   * the issuer DECLARED a binding, not whether the declared value happens to be
   * usable. A confirmation that names nothing is a declaration that cannot be
   * honoured, and the only safe response to one is refusal: downgrading it to
   * bearer semantics inverts the security property, because the WEAKEST possible
   * confirmation would buy the WIDEST possible acceptance.
   *
   * ⚠⚠ IT MUST BE ONE CHECK AHEAD OF THE BRANCHES RATHER THAN THREE INSIDE THEM,
   * and each branch shows why on its own:
   *   - NO PROOF, VOUCHED. `trustBoundThumbprint` says the proof was already
   *     checked upstream, so it substitutes for the PROOF and never for the
   *     binding the proof was checked against. It used to skip the only refusal
   *     on that path, so `cnf: { jkt: "" }` verified as a bearer token.
   *   - A PROOF SUPPLIED. The empty thumbprint was handed to `verifyDpopProof` as
   *     the value to match, and the comparison failed with
   *     `dpop_thumbprint_mismatch` — a refusal naming the PRESENTER'S key as the
   *     problem when the TOKEN'S confirmation is, and carrying no `data` at all.
   *   - NO PROOF, NO VOUCH. This one already refused, but for the wrong reason:
   *     `dpop_proof_required` tells a caller to go and fetch a proof for a
   *     binding no proof could ever satisfy.
   *
   * ⚠ TWO VALUES, ONE PREDICATE, AND THE SCOPE IS EXACTLY THOSE TWO.
   * `confirmation` answers for `cnf: {}` — an object binding nothing — and
   * `thumbprint` answers for `cnf: { jkt: "" }`. `isClaimOmitted` is vocabulary
   * presence and `isClaimSatisfied` is whether there is a value to bite on; the
   * gap between them IS this verdict.
   *
   * ⚠⚠ IT DOES NOT JUDGE THE OTHER FOUR MEMBERS, and saying so is the honest
   * version of the rule. Measured through the public `verify` door on both the
   * bare and the vouched path: `cnf: { kid: "" }`, `{ "x5t#S256": "" }`,
   * `{ jku: "" }` and `{ jwk: {} }` all verify. That is NOT a fail-open, and the
   * control is what shows it — their NON-empty forms verify as plain bearer
   * tokens too, because `jkt` is the only member aegis gates on at all. An empty
   * `kid` therefore loosens nothing: there is no check it slips past. If aegis
   * ever gates on a second member, that member joins this verdict on the same
   * day, and the prose here and in the error's `details` has to widen with it.
   *
   * ⚠ `data: { format }`, like every sibling refusal in this gate. It is what
   * makes the refusal attributable to the CONFIRMATION rather than to the
   * presenter's proof, whose own refusal carries no `data`.
   */
  const namedButUnsatisfied = (value: unknown): boolean =>
    !isClaimOmitted(value) && !isClaimSatisfied(value);

  /**
   * WHICH of the two values was named and unsatisfied — `cnf` for a confirmation
   * with no member, `cnf.jkt` for one whose thumbprint is empty.
   *
   * ⚠⚠ IT IS IN `data` BECAUSE `format` ALONE CANNOT DISCRIMINATE THIS REFUSAL
   * FROM ITS NEIGHBOUR, and that was measured rather than reasoned about. Every
   * refusal in this gate stamps `data: { format }` — including
   * `dpop_token_not_bound`, which fires on the SAME token when a proof is supplied
   * and this verdict is absent. A scenario row pinning `format` alone therefore
   * went green against the wrong refusal: deleting the `confirmation` half of the
   * predicate left the proof-path row passing, because the token fell through to
   * `dpop_token_not_bound` with an identical `data`. A refusal a row cannot tell
   * from its neighbour is a row that proves nothing.
   *
   * ⭐ It is also the more useful error: a consumer repairing a token learns WHICH
   * half of the confirmation is unusable rather than only that one of them is.
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
        "The token carries a confirmation that is empty, or one whose thumbprint (cnf.jkt) is present but empty. RFC 7800 makes the claim the issuer's declaration that the presenter holds a particular key and that the recipient can confirm it, so a declaration naming nothing cannot be honoured and is refused on every path, including the ones where a caller vouches that the proof was checked upstream. Only those two shapes are judged here: the thumbprint is the one confirmation member this verifier acts on, so an empty value in any other member passes no gate it could otherwise have failed.",
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
