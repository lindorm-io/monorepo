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
 * ⚠ `issuer` is the OPTIONAL-BOUND idiom — an ABSENT `iss` passes, a
 * CONTRADICTING one does not. RFC 7662 §2.2 makes `iss` a MAY in an
 * introspection response, and pylon has already pinned provenance without it:
 * the issuer is resolved BEFORE both arms, and the introspection call goes to
 * THAT issuer's endpoint, so WHICH authority answered is the pin. The `iss`
 * member is corroboration on top of a pin that already holds — a missing one
 * costs nothing, while one naming somebody else is a real conflict and is still
 * refused. Do NOT re-tighten this to `$eq`: the only answers it would newly
 * reject are the spec-conformant ones.
 *
 * ⚠ The bound is shared by both arms but only ever RELAXES the introspected one.
 * On the structured arm `iss` is mandatory twice over, before this pass runs:
 * the `access_token` profile lists `issuer` in `required`, and
 * `enforceVerifyFloor` exact-matches it against the issuer `verifyAccessToken`
 * hands in — the same issuer that SCOPES the key lookup, so a foreign token
 * cannot even reach a valid signature.
 *
 * ⚠ `tokenType` is NOT in this pass, and cannot be stated on the mount. The
 * structured arm asserts the JOSE `typ` through the `access_token` profile floor
 * (`application/at+jwt`, RFC 9068 §2.2); the introspected arm compares RFC
 * 7662's `token_type` against the scheme the request presented
 * (`assertIntrospectionScheme`). The two are homonyms, not the same field, so
 * there is no single value both arms could be matched against.
 */
export const assertResolvedAccess = (
  access: PylonResolvedAccess,
  options: AssertResolvedAccessOptions,
): void => {
  const predicate: DomainAssert = {
    issuer: { $or: [{ $exists: false }, { $eq: options.issuer }] },
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
