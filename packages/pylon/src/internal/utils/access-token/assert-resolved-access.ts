import { Aegis, type DomainAssert } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import type { AccessTokenMatchers, PylonResolvedAccess } from "../../../types/index.js";

export type AssertResolvedAccessOptions = {
  /**
   * The issuer this deployment accepts. Settled at boot and required on both
   * arms — see `resolveAccessIssuer`.
   */
  issuer: string;
  /** The mount's own claim matchers, exactly as the caller wrote them. */
  matchers: AccessTokenMatchers;
};

/**
 * The ONE claim gate over a resolved access credential — the same matchers, in
 * the same pass, on the same domain-keyed claims, whichever arm established
 * them, and whichever transport carried it. Running it here rather than inside
 * the structured verify is what stops a mount's `audience` (or any other
 * matcher) from being a silent no-op for an opaque credential, which is a
 * confused deputy: the JWT for the wrong audience was refused while the opaque
 * handle for the same wrong audience was served.
 *
 * ⚠ `issuer` is an EXACT match, on both arms. It used to be the optional-bound
 * idiom (`$or: [{ $exists: false }, { $eq }]`) because RFC 7662 makes `iss`
 * OPTIONAL in an introspection response — but the structured arm's profile floor
 * rejects a mismatched `iss` unconditionally, so tolerating an absent one here
 * made the opaque arm the laxer of two arms serving the same mount. An
 * authorization server that will not name itself is one this deployment cannot
 * pin, and pinning is the whole point.
 *
 * ⚠ `tokenType` is NOT in this pass, and cannot be stated on the mount. The
 * structured arm asserts the JOSE `typ` through the `access_token` profile floor
 * (`application/at+jwt`, RFC 9068 §2.2); the introspected arm asserts that its
 * answer declared one at all (`assertIntrospectionLive`). RFC 7662's
 * `token_type` and aegis's are homonyms, not the same field, so there is no
 * single value both arms could be matched against.
 */
export const assertResolvedAccess = (
  access: PylonResolvedAccess,
  options: AssertResolvedAccessOptions,
): void => {
  const predicate: DomainAssert = {
    issuer: { $eq: options.issuer },
    ...options.matchers,
  };

  try {
    Aegis.assert(access.claims as Dict, predicate);
  } catch (error) {
    if (!(error instanceof LindormError)) throw error;

    // `assert` keeps the failing claim VALUES in debug (not data); expose only
    // the KEYS to the client and keep the values server-side.
    const invalid = (error.debug as { invalid?: Array<{ key: string; value: unknown }> })
      ?.invalid;

    throw new ClientError("Access token claims rejected", {
      error,
      status: ClientError.Status.Unauthorized,
      code: "access_token_claims_invalid",
      type: "urn:lindorm:pylon:error:access_token_claims_invalid",
      title: "Access Token Claims Invalid",
      details:
        invalid
          ?.map((entry) => `${entry.key} (got: ${JSON.stringify(entry.value)})`)
          .join("; ") ?? error.message,
      data: {
        invalid: invalid?.map((entry) => entry.key),
        provenance: access.provenance,
      },
      debug: error.debug,
    });
  }
};
