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
   * raises is wire-neutral; a reader still needs to know which encoding produced
   * the failure, and it used to be told `jwt_` whichever wire it was.
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
 * The §4.4 verification floor for profiled verify, enforced UNCONDITIONALLY
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
 * What lives here rather than in the policy list is exactly what the policy list
 * cannot state: the algorithm the signature was verified under, the header typ,
 * and the two identities the VERIFIER supplies (its expected issuer and its own
 * audience). None of those is a property of the claims alone.
 */
export const enforceVerifyFloor = (input: VerifyFloorInput): void => {
  const { algorithm, audience, decodedTyp, expectedIssuer, format, payload, profile } =
    input;

  // FIRST, because it decides whether the signature proves anything at all —
  // reporting a claim mismatch on a token whose signing class the profile
  // rejects would name the lesser problem.
  //
  // `algClass` is the mirror of what mint does when it makes the class part of
  // the SIGNING floor, and the mint half alone buys nothing: `access_token`,
  // `external_access_token` and `delegation` declare `asymmetric` because a
  // shared MAC secret both verifies AND forges, which is a statement about
  // reading SOMEONE ELSE's token. A profile declaring no class is unconstrained
  // — `alg: none` is not a Kryptos algorithm, so "asymmetric or HS*" is the
  // whole space — and RFC 8417 / SSF (`security_event`) genuinely permits HS*.
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

  // The `exp` presence gate. It asks the DEMAND question in the same words
  // `required` uses, so it reads presence through the same predicate rather than
  // a bare comparison that could drift from it.
  //
  // ⚠ A SPELLING consolidation, NOT a coverage gain, and the difference matters
  // to whoever reads this next. TWO things rule the widened arm (`null`, `""`,
  // `[]`, `{}`) out, and BOTH are needed — `payload` is `{ ...custom, ...domain }`
  // (`verify-token.ts`), so naming only the first is not an argument:
  //   - the DOMAIN half comes from `toDate` (`internal/claims/translate.ts`),
  //     which returns `Date | undefined` and nothing else, into a bag that is
  //     then `omitUndefined`ed;
  //   - the CUSTOM half holds unconsumed wire keys under their ORIGINAL
  //     spelling, so a token carrying a literal `expiresAt` key would land there
  //     — `floorShadows` (same file) is what strips it, because a custom key may
  //     not impersonate a name the floor read resolves.
  // So no token exhibits a difference. What the predicate buys is that the
  // notion is named once: this was the last bare presence check in the floor.
  //
  // ⚠ It is NOT the only gate, nor a later-but-surer one. A profiled verify
  // reaches `applyVerifyPolicy` first, and its `expPresence` knob — which
  // `Aegis.verify` derives from this same `lifetime`, for a consumer-registered
  // profile exactly as for a built-in — refuses an absent `exp` there. This gate
  // is a duplicate that fires second and costs nothing; standing the earlier one
  // down was tried and reverted (see the derivation for why).
  //
  // ⚠ The negation stands where the house guard idiom would normally remove it:
  // this function is a flat sequence of `if (violated) throw` checks with no
  // early return to hang a happy-side guard on, and every sibling here is
  // likewise a negated positive test (`!audList.includes(audience)` above).
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
  // by the same enforcer with `direction: "verify"`. Every rule that names the
  // verify direction bites here, so nothing a profile declares can be a
  // mint-only constraint by accident of which call site remembered it. That
  // matters most for a profile reading someone else's token: an
  // `external_access_token` is never minted at all, so a mint-only rule of its
  // would never run anywhere.
  //
  // Verify passes an EMPTY context and always can: a context-reading rule is
  // pinned to mint by its own type.
  enforcePolicy({ claims: payload, context: {}, direction: "verify", format, profile });
};
