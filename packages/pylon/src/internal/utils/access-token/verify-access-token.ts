import type { IAegis, VerifiedToken, VerifyOptions } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";

/**
 * The ONE place a locally-verified access token is checked, and the ONE place a
 * verification failure becomes a 401.
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
  options: VerifyOptions,
): Promise<VerifiedToken> => {
  try {
    // `assert` is `undefined`: the claim matchers run once, afterwards, over the
    // resolved claims of BOTH arms.
    return await aegis.verify(token, undefined, {
      tokenType: "access_token",
      ...options,
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
