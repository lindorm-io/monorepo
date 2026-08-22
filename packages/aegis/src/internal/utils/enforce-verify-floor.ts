import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { TokenFormatTag, TokenProfile } from "../../types/index.js";
import { enforcePolicy } from "../profiles/enforce-policy.js";
import { algPermitted } from "./rules/alg-permitted.js";
import { isClaimSatisfied } from "./rules/is-claim-satisfied.js";

export type VerifyFloorInput = {
  /**
   * The algorithm the signature was ACTUALLY verified under — NOT a header
   * parameter read on trust. Every claims-bearing verify path refuses a header
   * `alg` that differs from the resolved key's own algorithm, and does so
   * before it accepts the signature: `JwtKit.verify` (`jwt_algorithm_mismatch`),
   * `JwsKit.verify` (`jws_algorithm_mismatch`) and the COSE `verifyCwt`
   * (`cwt_algorithm_mismatch` / `cwm_algorithm_mismatch`). So by the time the
   * floor runs, this value and `kryptos.algorithm` are the same string, and an
   * attacker cannot move it by editing the header — a lie there costs the
   * signature.
   */
  algorithm: string | undefined;
  audience: string;
  decodedTyp: string | undefined;
  /**
   * Overrides the expected `typ` (default: `profile.typ.value`). The COSE path
   * passes the CWT media type (e.g. `application/at+cwt`) so the floor matches
   * what mintCose stamped; the JOSE path leaves it unset and uses the profile's
   * (JWS) typ value.
   */
  expectedTyp?: string | undefined;
  expectedIssuer: string | undefined;
  /**
   * The wire the token actually is — DIAGNOSTIC only. Every code this floor
   * raises is wire-neutral, so this is the only thing telling a reader which
   * encoding produced the failure.
   */
  format: TokenFormatTag;
  /**
   * The DOMAIN-keyed parsed payload (`issuer`/`audience`/`expiresAt`), NOT the
   * raw wire claims. Both the JOSE and COSE verify paths produce this shape, so
   * the floor is format-agnostic.
   */
  payload: Dict;
  profile: TokenProfile;
};

const typMismatch = (
  decodedTyp: string | undefined,
  expected: string | undefined,
  profile: TokenProfile,
  format: TokenFormatTag,
): AegisDomainError =>
  new AegisDomainError("Invalid token", {
    // NOT `typ_mismatch`: this is specifically the PROFILE's mandate, and the
    // caller's own `assert.tokenType` mismatch is a different refusal raised by
    // the kit.
    code: "profile_typ_mismatch",
    data: { typ: decodedTyp, format },
    debug: { expected, profile: profile.name },
    title: "Profile Typ Mismatch",
    details:
      "The header typ does not match the typ mandated by the profile being verified.",
  });

/**
 * The verification floor for profiled verify, enforced UNCONDITIONALLY
 * on top of the standard signature/alg/exp/nbf checks JwtKit already runs:
 *
 *   - `algClass` — the algorithm the signature was verified under is of the
 *     class the profile permits (the verify half of the constraint mint applies
 *     when it SELECTS a signing key),
 *   - `typ` per the profile's presence policy: `required` demands an exact
 *     match, `none` runs no check (unless the COSE path overrides),
 *   - `iss` exact-match against the expected issuer,
 *   - `aud` contains the verifier's identity (`audience`),
 *   - `exp` SATISFIED when `profile.lifetime !== null` (no `$exists:false`
 *     escape — unlike the optional-when-present standard verify),
 *   - the profile's whole declared policy, for every rule naming the verify
 *     direction (`enforcePolicy` — the same call mint makes).
 *
 * `nbf`/`exp` value enforcement (with clock tolerance) is handled by the
 * standard verify; this floor only adds the presence + identity assertions.
 *
 * What lives here rather than in the policy list is what the policy list cannot
 * state: the algorithm the signature was verified under, the header typ, and the
 * two identities the VERIFIER supplies. None is a property of the claims alone.
 */
export const enforceVerifyFloor = (input: VerifyFloorInput): void => {
  const { algorithm, audience, decodedTyp, expectedIssuer, format, payload, profile } =
    input;

  // FIRST, because it decides whether the signature proves anything at all —
  // reporting a claim mismatch on a token whose signing class the profile
  // rejects would name the lesser problem.
  //
  // `algClass` mirrors the class mint makes part of the SIGNING floor, and the
  // mint half alone buys nothing: a profile declaring `asymmetric` does so because
  // a shared MAC secret both verifies AND forges, which is a statement about
  // reading SOMEONE ELSE's token. A profile declaring no class is unconstrained —
  // `alg: none` is not a Kryptos algorithm, so "asymmetric or HS*" is the whole
  // space.
  if (profile.algClass) {
    const invalid = algPermitted(algorithm, profile.algClass);

    if (invalid.length > 0) {
      throw new AegisDomainError("Invalid token", {
        code: "algorithm_not_permitted",
        data: { algorithm, invalid, format },
        debug: { algClass: profile.algClass, invalid, profile: profile.name },
        title: "Algorithm Not Permitted",
        details:
          "The token was verified under an algorithm whose class the profile does not permit, so its signature cannot prove what the profile requires of it.",
      });
    }
  }

  switch (profile.typ.presence) {
    case "none":
      // No profile typ to enforce — but a caller override (the COSE path) is a
      // media type mintCose actually stamped, so it is enforced as required.
      if (input.expectedTyp !== undefined && decodedTyp !== input.expectedTyp) {
        throw typMismatch(decodedTyp, input.expectedTyp, profile, format);
      }
      break;

    case "required": {
      const expected = input.expectedTyp ?? profile.typ.value;
      if (decodedTyp !== expected) {
        throw typMismatch(decodedTyp, expected, profile, format);
      }
      break;
    }

    default:
      throw new AegisDomainError("Unsupported typ presence", {
        code: "unsupported_typ_presence",
        data: { typ: profile.typ, format },
        debug: { profile: profile.name },
        title: "Unsupported Typ Presence",
        details:
          "The profile typ presence is not one of none or required, so the floor cannot enforce it.",
      });
  }

  if (expectedIssuer !== undefined && payload.issuer !== expectedIssuer) {
    throw new AegisDomainError("Invalid token", {
      code: "issuer_mismatch",
      data: { issuer: payload.issuer, format },
      debug: { expected: expectedIssuer, profile: profile.name },
      title: "Issuer Mismatch",
      details:
        "The token issuer (iss) does not exactly match the issuer expected for this profile.",
    });
  }

  const audList = isArray(payload.audience) ? (payload.audience as Array<string>) : [];

  if (!audList.includes(audience)) {
    throw new AegisDomainError("Invalid token", {
      code: "audience_mismatch",
      data: { audience: payload.audience, format },
      debug: { expected: audience, profile: profile.name },
      title: "Audience Mismatch",
      details:
        "The token audience (aud) does not contain the verifier's own identity supplied to verify.",
    });
  }

  // The `exp` presence gate, read through the same predicate `required` uses so
  // the two spellings cannot drift.
  //
  // ⚠ `payload` is `{ ...custom, ...domain }` (`verify-token.ts`): the domain half
  // is `Date | undefined` from `toDate`, and the custom half has had every key
  // impersonating a domain name stripped by `floorShadows`
  // (`internal/claims/translate.ts`) — so neither half can present a blank value
  // here.
  //
  // ⚠ Deliberately redundant with `applyVerifyPolicy`'s `expPresence` gate, which
  // `Aegis.verify` derives from this same `lifetime` and which runs first on a
  // profiled verify.
  if (profile.lifetime !== null && !isClaimSatisfied(payload.expiresAt)) {
    throw new AegisDomainError("Invalid token", {
      code: "missing_claim_exp",
      data: { format },
      debug: { profile: profile.name },
      title: "Missing Claim Exp",
      details:
        "This profile mandates an exp claim, but the token has none; it is rejected unconditionally.",
    });
  }

  // LAST, and it is the WHOLE profile policy — the same list mint enforces, run
  // by the same enforcer with `direction: "verify"`, so nothing a profile declares
  // becomes mint-only by accident of which call site remembered it. That matters
  // most for a profile that is never minted at all, whose mint-only rule would
  // then run nowhere.
  //
  // Verify passes an EMPTY context and always can: a context-reading rule is
  // pinned to mint by its own type.
  enforcePolicy({ claims: payload, context: {}, direction: "verify", format, profile });
};
