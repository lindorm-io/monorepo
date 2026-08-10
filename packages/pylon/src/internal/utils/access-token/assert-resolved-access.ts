import { Aegis, type DomainAssert, type ValidateJwtOptions } from "@lindorm/aegis";
import { ClientError, LindormError } from "@lindorm/errors";
import type { ConditionOperator } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { PylonResolvedAccess } from "../../../types/index.js";

export type AssertResolvedAccessOptions = {
  /**
   * The issuer this deployment accepts, or `null` when it resolved none. `null`
   * is only ever reached on the INTROSPECTED arm — the structured arm refuses to
   * verify without one, because an absent issuer matcher is not a weaker check,
   * it is NO check.
   */
  issuer: string | null;
  /** The mount's own claim matchers, exactly as the caller wrote them. */
  matchers: DomainAssert;
};

/**
 * The ONE claim gate over a resolved access credential — the same matchers, in
 * the same pass, on the same domain-keyed claims, whichever arm established
 * them. Running it here rather than inside the structured verify is what stops a
 * mount's `audience` (or any other matcher) from being a silent no-op for an
 * opaque credential, which is a confused deputy: the JWT for the wrong audience
 * was refused while the opaque handle for the same wrong audience was served.
 *
 * ⚠ `issuer` is the optional-bound idiom ON PURPOSE and is correct for both
 * arms. A structured token always carries `iss` (aegis refuses one without —
 * `jwt_missing_claim_iss`), so it is a hard check there; RFC 7662 makes `iss`
 * OPTIONAL in an introspection response, and the issuer is already established
 * by which endpoint you called. One expression, strict where the claim is
 * guaranteed.
 *
 * ⚠ `tokenType` is NOT in this pass. RFC 7662's `token_type` is the OAuth scheme
 * ("Bearer"); aegis's is the JOSE `typ`. Homonyms, not the same field — and the
 * structured arm already enforces the typ through its own `tokenType` knob.
 */
export const assertResolvedAccess = (
  access: PylonResolvedAccess,
  options: AssertResolvedAccessOptions,
): void => {
  // Each half is typed where it is BUILT — this one here, the caller's matchers
  // at the mount's own `UseAccessTokenOptions` — so the cast on the merge checks
  // nothing that was not already checked.
  //
  // ⚠ It is needed because `DomainClaimMatchers.issuer` is typed `string`,
  // unlike its array-valued siblings (`scope`, `roles`, …) which are
  // `string | Array<string> | ConditionOperator<…>`. The matcher engine
  // evaluates the optional-bound form correctly; only the declared type refuses
  // it. Widening that ONE field in @lindorm/aegis removes this.
  const predicate = {
    ...(options.issuer === null
      ? {}
      : {
          issuer: {
            $or: [{ $exists: false }, { $eq: options.issuer }],
          } satisfies ConditionOperator<string>,
        }),
    ...options.matchers,
  };

  try {
    Aegis.assert(access.claims as Dict, predicate as ValidateJwtOptions);
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
