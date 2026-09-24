import { isClaimsBearingToken, type VerifiedToken } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type {
  AccessTokenProfile,
  PylonAnyContext,
  PylonAuthCacheEntry,
  PylonResolvedAccess,
} from "../../../types/index.js";
import { assertIntrospectionLive } from "./assert-introspection-live.js";
import {
  assertIntrospectionScheme,
  type PresentedScheme,
} from "./assert-introspection-scheme.js";
import { deploymentCritical } from "../tokens/deployment-critical.js";
import { resolveAccessIssuer } from "./resolve-access-issuer.js";
import { verifyAccessToken } from "./verify-access-token.js";

export type ResolveAccessOptions = {
  /**
   * The resource server's own identifier. The structured arm hands it to the
   * profile floor (RFC 9068 §4); the introspected arm gets it as an ordinary
   * matcher in the shared assert, which is what makes ONE stated audience apply
   * to both.
   */
  audience: string;
  cache: PylonAuthCacheEntry | undefined;
  /**
   * The aegis profile the STRUCTURED arm verifies against. Only that arm reads
   * it: an introspection answer is the authorization server's own assertion, and
   * there is no JOSE envelope on it for a profile floor to judge.
   */
  profile: AccessTokenProfile;
  /**
   * The RFC 6749 §7.1 scheme the credential was PRESENTED under, or `undefined`
   * on a transport that carries no authorization scheme at all. Required — not
   * optional — so every caller has to state which of the two it is rather than
   * omitting it by accident.
   *
   * Only the introspected arm reads it: it is the value RFC 7662's `token_type`
   * is compared against (`assertIntrospectionScheme`). The structured arm has no
   * use for it — a bound token's scheme is settled by `cnf.jkt` and the proof.
   */
  scheme: PresentedScheme | undefined;
};

export type ResolvedAccess = {
  access: PylonResolvedAccess;
  /**
   * The issuer the credential is pinned to — settled at boot, required on BOTH
   * arms. The structured arm scopes its key lookup by it; the introspected arm
   * compares the answer's `iss` against it, because an introspection response
   * that declines to name an issuer must not pass a check the structured arm
   * enforces unconditionally.
   */
  issuer: string;
  /**
   * The `VerifiedToken` the STRUCTURED arm produced, and `undefined` on the
   * opaque one — there is no VerifiedToken behind an introspection answer, and
   * synthesising one would erase the very provenance distinction
   * {@link PylonResolvedAccess} exists to preserve.
   */
  verified: VerifiedToken | undefined;
};

/**
 * Resolve a presented credential into the ONE access shape every transport and
 * every downstream gate reads — the single implementation of the two arms, so a
 * check written once cannot apply to only one of them.
 *
 * The routing question is whether aegis can establish this credential's CLAIMS
 * locally — not which wire family it belongs to. A signed but OPAQUE token (a
 * JWS, or its COSE twin a CWS) is an authorization server's handle: aegis can
 * check its signature and still learn nothing, so verifying it here would
 * resolve an access state with EMPTY claims — no expiry, no revocation, no
 * grant — while never asking the only party that knows. Aegis owns the
 * claims-bearing taxonomy (it is the same split its `parse` draws), so the
 * predicate is its, not a second copy here.
 *
 * SNIFFED from the wire, never inferred from a failed verify: falling through on
 * failure would hand a tampered JWT to introspection, asking an authorization
 * server about a string it never issued.
 *
 * Each arm owns its own TEMPORAL reasoning — aegis range-checks a structured
 * token's `exp`/`nbf` inside verify, while the introspected arm gets
 * `assertIntrospectionLive` — and NEITHER owns the claim matchers, which are one
 * shared pass over the result.
 *
 * The ISSUER is resolved BEFORE the arms and required by both. A settled issuer
 * is what the structured arm scopes its key lookup by and what the introspected
 * arm compares the answer's `iss` against; letting the opaque arm run without
 * one made "the authorization server is the authority" (RFC 7662) into "no
 * issuer check at all", which is the laxer of the two arms and the one an
 * attacker picks.
 */
export const resolveAccess = async (
  ctx: PylonAnyContext,
  token: string,
  options: ResolveAccessOptions,
): Promise<ResolvedAccess> => {
  const issuer = resolveAccessIssuer(ctx);

  if (isClaimsBearingToken(token)) {
    const verified = await verifyAccessToken(ctx.aegis, token, {
      audience: options.audience,
      critical: deploymentCritical(ctx.state.app.config.auth),
      issuer,
      profile: options.profile,
    });

    return {
      access: {
        provenance: "verified",
        claims: verified.claims,
        custom: verified.custom,
        token,
      },
      issuer,
      verified,
    };
  }

  // Opaque ⇒ the authorization server is the only authority on it (RFC 7662),
  // and a driver with no `introspect` cannot ask. That is the NORMAL
  // configuration for a service that mints and verifies its own JWTs, so it is
  // answered as what it is — this deployment does not accept opaque credentials
  // — rather than as a verification that mysteriously failed.
  if (!ctx.state.app.config.auth?.capabilities.introspect) {
    throw new ClientError("Opaque access tokens are not accepted", {
      status: ClientError.Status.Unauthorized,
      code: "opaque_token_not_supported",
      type: "urn:lindorm:pylon:error:opaque_token_not_supported",
      title: "Opaque Token Not Supported",
      details:
        "The presented credential carries no claims layer this service can verify locally — it is an opaque handle, or a signed blob (JWS/CWS) with no claims — and the configured auth driver implements no `introspect` method (RFC 7662) to resolve it with. Present a claims-bearing token (JWT, CWT, or a sign-then-encrypt JWE/CWE wrapping one).",
    });
  }

  // ONE introspection call site. The cache is INSIDE `ctx.auth.introspect` —
  // short-lived by construction, the TTL being the revocation window (RFC 7662
  // §5) — so this states only its own carve-out and never picks between a cached
  // resolver and an uncached one.
  const introspection = await ctx.auth.introspect(token, { cache: options.cache });

  if (!introspection.active) {
    throw new ClientError("Access token is not active", {
      status: ClientError.Status.Unauthorized,
      code: "token_not_active",
      type: "urn:lindorm:pylon:error:token_not_active",
      title: "Token Not Active",
      details: "Token introspection returned active: false",
    });
  }

  assertIntrospectionScheme(introspection, options.scheme);

  assertIntrospectionLive(introspection);

  // `active` and `tokenType` are RFC 7662 §2.2 facts about the ANSWER, not
  // claims of the token, so neither reaches the resolved credential: `active` is
  // a rejection signal already consumed above (it would be permanently `true`
  // here), and `tokenType` — RFC 6749 §7.1's presentation scheme, a homonym of
  // the JOSE `typ` the structured arm asserts — has no counterpart in
  // `DomainClaims`. Both are asserted BEFORE the strip — `active` just above,
  // `tokenType` in `assertIntrospectionScheme` — so dropping them loses no check.
  const { active: _active, custom, tokenType: _tokenType, ...claims } = introspection;

  return {
    access: {
      provenance: "introspected",
      claims,
      custom,
      token,
    },
    issuer,
    verified: undefined,
  };
};
