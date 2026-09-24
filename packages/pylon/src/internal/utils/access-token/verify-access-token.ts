import type { IAegis, VerifiedToken } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";
import type { AccessTokenProfile } from "../../../types/index.js";

export type VerifyAccessTokenOptions = {
  /** The resource server's own identifier — the `aud` the token must contain. */
  audience: string;
  critical: Array<string> | undefined;
  /** The one issuer this deployment is a party to. */
  issuer: string;
  /**
   * The aegis profile whose floor the credential must clear. Resolved at the
   * mount, never defaulted here — a use-time default is the one thing that could
   * put a token under a floor nobody chose.
   */
  profile: AccessTokenProfile;
};

/**
 * The ONE place a locally-verified access token is checked, and the ONE place a
 * verification failure becomes a 401.
 *
 * Verified against a PROFILE, not the profile-less verify. Three things follow,
 * and each of them was previously either absent or a mount's to weaken:
 *
 * - the `typ` floor is the profile's — `application/at+jwt` on `access_token`
 *   (RFC 9068 §2.2), so an id_token, a logout token or a refresh artifact
 *   presented as a bearer credential is refused by the profile rather than by an
 *   option a deployment could override,
 * - `aud` MUST contain this resource server's identifier (RFC 9068 §4), which is
 *   why `audience` is a required mount option,
 * - `iss` SCOPES the verification key lookup, not just the claim comparison, so
 *   a colliding `kid` from another registered issuer can never produce a valid
 *   signature. The profile-less path takes no issuer at all and had no such
 *   scoping.
 *
 * ⚠ `external_access_token` mandates no `typ`, so the first of those three is
 * carried by that profile's `forbidden` list instead — see
 * {@link AccessTokenProfile}.
 *
 * ⚠ The conversion is scoped to THIS CALL rather than to a list of error
 * classes, because the class list cannot be kept honest: aegis's own contract is
 * that a consumer catches `AegisError`, and its key resolver upholds it by
 * catching every amphora failure — including a JWKS fetch that never
 * answered — and rethrowing it as `AegisKeyError`. But the crypto layer beneath
 * it does not: a signature of the wrong length surfaces as an `EcError` from
 * `@lindorm/ec`, a package pylon does not even depend on. Allowlisting classes
 * would either miss that (a malformed token reported as a 500) or grow a list of
 * every curve package, which the next one silently escapes.
 *
 * The call scope has no such hole. Everything reachable from here is a verdict
 * on bytes the caller presented — signature, algorithm, typ, temporal range, the
 * `kid` it named — because aegis has already converted the one thing that is
 * NOT (its key lookup). Nothing operational is inside this boundary, and
 * `ctx.auth.introspect` — where a driver's storage failure lives — is outside it
 * entirely.
 */
export const verifyAccessToken = async (
  aegis: IAegis,
  token: string,
  options: VerifyAccessTokenOptions,
): Promise<VerifiedToken> => {
  try {
    // `assert` is `undefined`: the claim matchers run once, afterwards, over the
    // resolved claims of BOTH arms.
    //
    // ⚠ That is also what keeps pylon clear of the profiled-verify defect where a
    // COSE token's `assert` argument is dropped: there is no assert to drop here,
    // and a CWT access token IS reachable (`isClaimsBearingToken` accepts one).
    //
    // `trustBoundThumbprint` tells aegis the CALLER validates the DPoP binding —
    // which pylon does, uniformly, in `assertDpopBinding`. Without it aegis would
    // reject every bound token for want of a proof it was not given, and handing
    // it the proof as well would mean verifying the same proof twice on the
    // verified path and once on the introspected one.
    return await aegis.verify(options.profile, token, undefined, {
      audience: options.audience,
      critical: options.critical,
      issuer: options.issuer,
      trustBoundThumbprint: true,
    });
  } catch (error: any) {
    // A named pylon error thrown from inside (nothing does today, but a future
    // key-policy hook might) already carries its own status and reason.
    if (error instanceof ClientError || error instanceof ServerError) throw error;

    throw new ClientError("Access token verification failed", {
      error,
      status: ClientError.Status.Unauthorized,
      code: "access_token_verification_failed",
      type: "urn:lindorm:pylon:error:access_token_verification_failed",
      title: "Access Token Verification Failed",
      details: error.message,
    });
  }
};
