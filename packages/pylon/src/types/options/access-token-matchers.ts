import type { DomainAssert } from "@lindorm/aegis";

/**
 * The claim matchers an access-token mount may state — `aegis`'s
 * {@link DomainAssert} vocabulary, minus the two keys a MOUNT has no business
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
 *   it would let it accept an ID token as a bearer credential. What KIND of
 *   artifact this mount accepts is settled by the profile it verifies against
 *   ({@link import("./access-token-profile.js").AccessTokenProfile}) — by its
 *   `typ` floor on the strict one, by its forbidden claims on the lenient one —
 *   never by a matcher.
 *
 * ⚠ The OIDC Core §3.1.3.6 hash-DERIVE inputs (`accessToken`/`authCode`/
 * `authState`, for `at_hash`/`c_hash`/`s_hash`) need no exclusion: they are not
 * on {@link DomainAssert} at all. They hash their source with the TOKEN's own
 * signing algorithm, which is a header parameter, so they live on aegis's
 * `VerifyAssert` — the surface that holds a key — and an `Omit` naming them here
 * would be a silent no-op, because TypeScript permits omitting a key a type does
 * not have. The already-computed `accessTokenHash`/`codeHash`/`stateHash` claims
 * ARE ordinary matchers and stay statable, as on every other claim surface.
 *
 * Kept substitutable with `useAccess`'s {@link import("../../middleware/common/use-access.js").UseAccessOptions}
 * — the same matcher vocabulary, so a check written for one reads the same on
 * the other.
 */
export type AccessTokenMatchers = Required<Pick<DomainAssert, "audience">> &
  Omit<DomainAssert, "issuer" | "audience" | "tokenType">;
