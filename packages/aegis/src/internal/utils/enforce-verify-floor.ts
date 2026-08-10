import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";
import { algPermitted } from "./rules/alg-permitted.js";

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
): AegisDomainError =>
  new AegisDomainError("Invalid token", {
    code: "jwt_typ_mismatch",
    data: { typ: decodedTyp },
    debug: { expected, profile: profile.name },
    title: "JWT Typ Mismatch",
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
 *   - `exp` PRESENT when `profile.lifetime !== null` (no `$exists:false`
 *     escape — unlike the optional-when-present standard verify),
 *   - every claim in `profile.required` is PRESENT, and every claim in
 *     `profile.forbidden` is ABSENT (mint/verify symmetry — the same
 *     domain-keyed names `enforceProfilePolicy` enforces at mint).
 *
 * `nbf`/`exp` value enforcement (with clock tolerance) is handled by the
 * standard verify; this floor only adds the presence + identity assertions.
 */
export const enforceVerifyFloor = (input: VerifyFloorInput): void => {
  const { algorithm, audience, decodedTyp, expectedIssuer, payload, profile } = input;

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
        code: "jwt_algorithm_not_permitted",
        data: { algorithm, invalid },
        debug: { algClass: profile.algClass, invalid, profile: profile.name },
        title: "JWT Algorithm Not Permitted",
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
        throw typMismatch(decodedTyp, input.expectedTyp, profile);
      }
      break;

    case "required": {
      const expected = input.expectedTyp ?? profile.typ.value;
      if (decodedTyp !== expected) {
        throw typMismatch(decodedTyp, expected, profile);
      }
      break;
    }

    default:
      throw new AegisDomainError("Unsupported typ presence", {
        code: "unsupported_typ_presence",
        data: { typ: profile.typ },
        debug: { profile: profile.name },
        title: "Unsupported Typ Presence",
        details:
          "The profile typ presence is not one of none or required, so the floor cannot enforce it.",
      });
  }

  if (expectedIssuer !== undefined && payload.issuer !== expectedIssuer) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_issuer_mismatch",
      data: { issuer: payload.issuer },
      debug: { expected: expectedIssuer, profile: profile.name },
      title: "JWT Issuer Mismatch",
      details:
        "The token issuer (iss) does not exactly match the issuer expected for this profile.",
    });
  }

  const audList = isArray(payload.audience) ? (payload.audience as Array<string>) : [];

  if (!audList.includes(audience)) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_audience_mismatch",
      data: { audience: payload.audience },
      debug: { expected: audience, profile: profile.name },
      title: "JWT Audience Mismatch",
      details:
        "The token audience (aud) does not contain the verifier's own identity supplied to verify.",
    });
  }

  if (profile.lifetime !== null && payload.expiresAt === undefined) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_missing_claim_exp",
      debug: { profile: profile.name },
      title: "JWT Missing Claim Exp",
      details:
        "This profile mandates an exp claim, but the token has none; it is rejected unconditionally.",
    });
  }

  const missing = profile.required.filter((key) => {
    const value = payload[key];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_required_claims_missing",
      data: { missing },
      debug: { missing, profile: profile.name },
      title: "JWT Required Claims Missing",
      details:
        "The token is missing claims that the profile being verified requires to be present.",
    });
  }

  // `forbidden` is the mirror of `required`, and it has to bite HERE as well as
  // at mint: a profile that verifies tokens minted elsewhere gets no benefit
  // from a mint-time policy. It is what separates two artifact KINDS whose
  // envelopes no longer separate them — an `external_access_token` accepts any
  // typ, so `nonce`/`at_hash`/`c_hash`/`s_hash` (id_token claims an access
  // token never carries) are the discriminator that keeps an id_token out.
  const present = profile.forbidden.filter((key) => {
    const value = payload[key];
    return value !== undefined && value !== null && value !== "";
  });

  if (present.length > 0) {
    throw new AegisDomainError("Invalid token", {
      code: "jwt_forbidden_claims_present",
      data: { forbidden: present },
      debug: { forbidden: present, profile: profile.name },
      title: "JWT Forbidden Claims Present",
      details:
        "The token carries claims the profile being verified forbids, so it is not a token of that kind.",
    });
  }
};
