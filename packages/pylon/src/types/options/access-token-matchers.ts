import type { DomainAssert } from "@lindorm/aegis";

/**
 * The claim matchers an access-token mount may state — `aegis`'s
 * {@link DomainAssert} vocabulary, minus the six keys a MOUNT has no business
 * deciding, plus `audience` re-added as REQUIRED.
 *
 * A matcher asserts what must be true of the credential; everything a mount can
 * say here is that. The verify KNOBS (`clockTolerance`, `currentDate`, `key`,
 * `typPresence`, …) are deliberately absent: they change how the check runs, and
 * a route is not the place to loosen a deployment's verification policy.
 *
 * The exclusions, each for its own reason:
 *
 * - `issuer` — pylon derives it from the resolved auth issuer
 *   (`ctx.state.app.config.auth.issuer`, settled once at boot by amphora for the
 *   scope the auth driver named). A per-mount issuer would restate a deployment
 *   constant at every mount, free to disagree with the keys verification
 *   actually runs against.
 * - `audience` — REQUIRED rather than excluded, because ONLY the mount knows the
 *   resource server's own identifier and RFC 9068 §4 has a resource server MUST
 *   validate `aud`. It is also what makes the profiled verify usable
 *   (`ProfileVerifyOptions.audience` is required), and it closes a live
 *   fail-open: an `audience` stated on this mount used to be applied on the
 *   locally-verified branch alone, so a JWT audienced elsewhere was refused
 *   while the OPAQUE handle for the same wrong audience was served.
 * - `tokenType` — must NOT be mount-overridable. Letting a deployment override
 *   it would let it accept an ID token as a bearer credential. The access-token
 *   profile's own `typ` floor (`application/at+jwt`, RFC 9068 §2.2) is the only
 *   answer this mount accepts.
 * - `accessToken`/`authCode`/`authState` — the OIDC Core §3.1.3.6 hash-derive
 *   inputs (`at_hash`/`c_hash`/`s_hash`). They assert that a token carries the
 *   digest of ANOTHER artifact from the same authorization response, which is an
 *   id_token's question; on an access-token mount there is no second artifact to
 *   hash.
 *
 * Kept substitutable with `useAccess`'s {@link import("../../middleware/common/use-access.js").UseAccessOptions}
 * — the same matcher vocabulary, so a check written for one reads the same on
 * the other.
 */
export type AccessTokenMatchers = Required<Pick<DomainAssert, "audience">> &
  Omit<
    DomainAssert,
    "issuer" | "audience" | "tokenType" | "accessToken" | "authCode" | "authState"
  >;
