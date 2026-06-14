import { isArray, isFinite, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";

export type VerifyFloorInput = {
  audience: string;
  decodedTyp: string | undefined;
  expectedIssuer: string | undefined;
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

  if (profile.typ !== null && decodedTyp !== profile.typ) {
    throw new JwtError("Invalid token", {
      code: "jwt_typ_mismatch",
      data: { typ: decodedTyp },
      debug: { expected: profile.typ, profile: profile.name },
      title: "JWT Typ Mismatch",
      details:
        "The header typ does not match the typ mandated by the profile being verified.",
    });
  }

  if (expectedIssuer !== undefined && payload.iss !== expectedIssuer) {
    throw new JwtError("Invalid token", {
      code: "jwt_issuer_mismatch",
      data: { iss: payload.iss },
      debug: { expected: expectedIssuer, profile: profile.name },
      title: "JWT Issuer Mismatch",
      details:
        "The token iss does not exactly match the issuer expected for this profile.",
    });
  }

  const aud = payload.aud;
  const audList = isArray(aud) ? aud : isString(aud) ? [aud] : [];

  if (!audList.includes(audience)) {
    throw new JwtError("Invalid token", {
      code: "jwt_audience_mismatch",
      data: { aud },
      debug: { expected: audience, profile: profile.name },
      title: "JWT Audience Mismatch",
      details:
        "The token aud does not contain the verifier's own identity supplied to verify.",
    });
  }

  if (profile.lifetime !== null && !isFinite(payload.exp)) {
    throw new JwtError("Invalid token", {
      code: "jwt_missing_claim_exp",
      debug: { profile: profile.name },
      title: "JWT Missing Claim Exp",
      details:
        "This profile mandates an exp claim, but the token has none; it is rejected unconditionally.",
    });
  }
};
