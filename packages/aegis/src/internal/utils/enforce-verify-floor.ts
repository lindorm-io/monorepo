import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";

export type VerifyFloorInput = {
  audience: string;
  decodedTyp: string | undefined;
  /**
   * Overrides the expected `typ` (default: `profile.typ`). The COSE path passes
   * the CWT media type (e.g. `application/at+cwt`) so the floor matches what
   * mintCose stamped; the JOSE path leaves it unset and uses `profile.typ`.
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

/**
 * The §4.4 verification floor for profiled verify, enforced UNCONDITIONALLY
 * on top of the standard signature/alg/exp/nbf checks JwtKit already runs:
 *
 *   - `typ` === `profile.typ` (when the profile mandates a typ),
 *   - `iss` exact-match against the expected issuer,
 *   - `aud` contains the verifier's identity (`audience`),
 *   - `exp` PRESENT when `profile.lifetime !== null` (no `$exists:false`
 *     escape — unlike the optional-when-present standard verify).
 *
 * `nbf`/`exp` value enforcement (with clock tolerance) is handled by the
 * standard verify; this floor only adds the presence + identity assertions.
 */
export const enforceVerifyFloor = (input: VerifyFloorInput): void => {
  const { audience, decodedTyp, expectedIssuer, payload, profile } = input;

  // The COSE path overrides the expected typ with the CWT media type; the JOSE
  // path leaves it unset and falls back to the profile's (JWS) typ.
  const expectedTyp = input.expectedTyp ?? profile.typ;

  if (expectedTyp !== null && decodedTyp !== expectedTyp) {
    throw new JwtError("Invalid token", {
      code: "jwt_typ_mismatch",
      data: { typ: decodedTyp },
      debug: { expected: expectedTyp, profile: profile.name },
      title: "JWT Typ Mismatch",
      details:
        "The header typ does not match the typ mandated by the profile being verified.",
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
};
