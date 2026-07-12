import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";

export type VerifyFloorInput = {
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
): JwtError =>
  new JwtError("Invalid token", {
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
 *   - `typ` per the profile's presence policy: `required` demands an exact
 *     match, `optional` accepts an absent typ but a present one must match
 *     exactly, `none` runs no check (unless the COSE path overrides),
 *   - `iss` exact-match against the expected issuer,
 *   - `aud` contains the verifier's identity (`audience`),
 *   - `exp` PRESENT when `profile.lifetime !== null` (no `$exists:false`
 *     escape — unlike the optional-when-present standard verify),
 *   - every claim in `profile.required` is PRESENT (mint/verify symmetry —
 *     the same domain-keyed names `enforceProfilePolicy` enforces at mint).
 *
 * `nbf`/`exp` value enforcement (with clock tolerance) is handled by the
 * standard verify; this floor only adds the presence + identity assertions.
 */
export const enforceVerifyFloor = (input: VerifyFloorInput): void => {
  const { audience, decodedTyp, expectedIssuer, payload, profile } = input;

  switch (profile.typ.presence) {
    case "none":
      // No profile typ to enforce — but a caller override (the COSE path) is a
      // media type mintCose actually stamped, so it is enforced as required.
      if (input.expectedTyp !== undefined && decodedTyp !== input.expectedTyp) {
        throw typMismatch(decodedTyp, input.expectedTyp, profile);
      }
      break;

    case "optional": {
      // Absent typ is accepted (RFC 7523 client assertions from stock
      // libraries omit it); a present typ must still match exactly (RFC 8725).
      const expected = input.expectedTyp ?? profile.typ.value;
      if (decodedTyp !== undefined && decodedTyp !== expected) {
        throw typMismatch(decodedTyp, expected, profile);
      }
      break;
    }

    case "required": {
      const expected = input.expectedTyp ?? profile.typ.value;
      if (decodedTyp !== expected) {
        throw typMismatch(decodedTyp, expected, profile);
      }
      break;
    }

    default:
      throw new JwtError("Unsupported typ presence", {
        code: "unsupported_typ_presence",
        data: { typ: profile.typ },
        debug: { profile: profile.name },
        title: "Unsupported Typ Presence",
        details:
          "The profile typ presence is not one of none, optional, or required, so the floor cannot enforce it.",
      });
  }

  if (expectedIssuer !== undefined && payload.issuer !== expectedIssuer) {
    throw new JwtError("Invalid token", {
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
    throw new JwtError("Invalid token", {
      code: "jwt_audience_mismatch",
      data: { audience: payload.audience },
      debug: { expected: audience, profile: profile.name },
      title: "JWT Audience Mismatch",
      details:
        "The token audience (aud) does not contain the verifier's own identity supplied to verify.",
    });
  }

  if (profile.lifetime !== null && payload.expiresAt === undefined) {
    throw new JwtError("Invalid token", {
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
    throw new JwtError("Invalid token", {
      code: "jwt_required_claims_missing",
      data: { missing },
      debug: { missing, profile: profile.name },
      title: "JWT Required Claims Missing",
      details:
        "The token is missing claims that the profile being verified requires to be present.",
    });
  }
};
