import {
  isClaimsBearingToken,
  type VerifiedToken,
  type VerifyOptions,
} from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type {
  PylonAnyContext,
  PylonAuthCacheEntry,
  PylonResolvedAccess,
} from "../../../types/index.js";
import { assertIntrospectionLive } from "./assert-introspection-live.js";
import { resolveAccessIssuer } from "./resolve-access-issuer.js";
import { verifyAccessToken } from "./verify-access-token.js";

export type ResolveAccessOptions = {
  cache: PylonAuthCacheEntry | undefined;
  /**
   * The `aegis.verify` KNOBS only — the claim matchers are asserted AFTER
   * resolution, once, on whichever claims the arm produced
   * ({@link import("./assert-resolved-access.js").assertResolvedAccess}).
   */
  verifyOptions: VerifyOptions;
};

export type ResolvedAccess = {
  access: PylonResolvedAccess;
  /**
   * The issuer the credential is pinned to. Never `null` on the structured arm —
   * `resolveAccessIssuer` refuses to verify without one. `null` on the opaque arm
   * of a deployment that settled no issuer, where RFC 7662 makes the
   * authorization server the authority and there is nothing to pin.
   */
  issuer: string | null;
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
 * token's `exp`/`nbf` with clock tolerance inside verify, while the introspected
 * arm gets `assertIntrospectionLive` — and NEITHER owns the claim matchers,
 * which are one shared pass over the result.
 */
export const resolveAccess = async (
  ctx: PylonAnyContext,
  token: string,
  options: ResolveAccessOptions,
): Promise<ResolvedAccess> => {
  if (isClaimsBearingToken(token)) {
    const issuer = resolveAccessIssuer(ctx);

    // `trustBoundThumbprint` tells aegis the CALLER validates the DPoP binding
    // — which pylon does, uniformly, in `assertDpopBinding`. Without it aegis
    // would reject every bound token for want of a proof it was not given, and
    // handing it the proof as well would mean verifying the same proof twice on
    // the verified path and once on the introspected one — two implementations
    // of one check, free to drift.
    const verified = await verifyAccessToken(ctx.aegis, token, {
      ...options.verifyOptions,
      trustBoundThumbprint: true,
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

  assertIntrospectionLive(introspection, options.verifyOptions.currentDate ?? new Date());

  // `active` and `tokenType` are RFC 7662 §2.2 facts about the ANSWER, not
  // claims of the token, so neither reaches the resolved credential: `active` is
  // a rejection signal already consumed above (it would be permanently `true`
  // here), and `tokenType` has no counterpart on the verified path — leaving it
  // in would put a field in `claims` that only ever appears on one provenance
  // and that `DomainClaims` does not declare.
  const { active: _active, custom, tokenType: _tokenType, ...claims } = introspection;

  return {
    access: {
      provenance: "introspected",
      claims,
      custom,
      token,
    },
    // RFC 7662 makes the authorization server the authority on an opaque
    // credential, so a deployment whose driver could not settle an issuer still
    // resolves one — there is simply nothing to pin it to.
    issuer: ctx.state.app.config.auth.issuer,
    verified: undefined,
  };
};
