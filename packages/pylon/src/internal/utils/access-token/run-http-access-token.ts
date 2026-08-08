import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import type { PylonAuthCacheEntry, PylonHttpContext } from "../../../types/index.js";
import { assertDpopHttpBinding } from "../dpop/assert-dpop-http-binding.js";
import { extractTokenFromSession } from "../tokens/extract-token-from-session.js";
import { isLocallyVerifiable } from "../tokens/is-locally-verifiable.js";
import { resolveHttpTokenSource } from "../tokens/resolve-http-token-source.js";
import { splitVerifyInput } from "../tokens/split-verify-input.js";
import { resolveAccessIssuer } from "./resolve-access-issuer.js";

type Options = {
  cache: PylonAuthCacheEntry | undefined;
  verifyInput: Omit<DomainAssert & VerifyOptions, "issuer">;
};

export const runHttpAccessToken = async (
  ctx: PylonHttpContext,
  options: Options,
): Promise<void> => {
  const source = resolveHttpTokenSource(ctx);

  if (source.kind === "bearer" || source.kind === "dpop") {
    const dpopProof =
      source.kind === "dpop"
        ? ((ctx.get("dpop") as string | undefined) ?? undefined)
        : undefined;

    if (source.kind === "dpop" && (!dpopProof || dpopProof.length === 0)) {
      throw new ClientError("Missing DPoP header", {
        details: "DPoP scheme requires a DPoP header on the request",
        status: ClientError.Status.Unauthorized,
        code: "missing_dpop_header",
        type: "urn:lindorm:pylon:error:missing_dpop_header",
        title: "Missing DPoP Header",
        data: { scheme: "dpop" },
      });
    }

    if (isLocallyVerifiable(source.token)) {
      // `trustBoundThumbprint` tells aegis the CALLER validates the DPoP binding
      // — which pylon now does, uniformly, in `assertDpopHttpBinding` below.
      // Without it aegis would reject every bound token for want of a proof it
      // was not given, and handing it the proof as well would mean verifying the
      // same proof twice on the verified path and once on the introspected one —
      // two implementations of one check, free to drift.
      const { assert, options: verifyOptions } = splitVerifyInput({
        tokenType: "access_token",
        issuer: resolveAccessIssuer(ctx),
        ...options.verifyInput,
        trustBoundThumbprint: true,
      } as DomainAssert & VerifyOptions);

      const verified = await ctx.aegis.verify(source.token, assert, verifyOptions);

      ctx.state.tokens.accessToken = verified;
      ctx.state.access = {
        provenance: "verified",
        claims: verified.claims,
        custom: verified.custom,
        token: source.token,
      };
    } else {
      // Opaque ⇒ the authorization server is the only authority on it (RFC
      // 7662), and a driver with no `introspect` cannot ask. That is the NORMAL
      // configuration for a service that mints and verifies its own JWTs, so it
      // is answered as what it is — this deployment does not accept opaque
      // credentials — rather than as a verification that mysteriously failed.
      if (!ctx.state.app.config.auth?.capabilities.introspect) {
        throw new ClientError("Opaque access tokens are not accepted", {
          status: ClientError.Status.Unauthorized,
          code: "opaque_token_not_supported",
          type: "urn:lindorm:pylon:error:opaque_token_not_supported",
          title: "Opaque Token Not Supported",
          details:
            "The presented credential is not a JOSE or COSE token this service can verify locally, and the configured auth driver implements no `introspect` method (RFC 7662) to resolve it with. Present a locally verifiable token.",
        });
      }

      // ONE introspection call site. The cache is INSIDE `ctx.auth.introspect`
      // — short-lived by construction, the TTL being the revocation window (RFC
      // 7662 §5) — so this mount states only its own carve-out and never picks
      // between a cached resolver and an uncached one.
      const introspection = await ctx.auth.introspect(source.token, {
        cache: options.cache,
      });

      if (!introspection.active) {
        throw new ClientError("Access token is not active", {
          status: ClientError.Status.Unauthorized,
          code: "token_not_active",
          type: "urn:lindorm:pylon:error:token_not_active",
          title: "Token Not Active",
          details: "Token introspection returned active: false",
        });
      }

      const { active: _active, custom, ...claims } = introspection;

      // `ctx.state.tokens.accessToken` is deliberately left UNSET here: there is
      // no VerifiedToken, and synthesising one would erase the very provenance
      // distinction `ctx.state.access` exists to preserve.
      ctx.state.access = {
        provenance: "introspected",
        claims,
        custom,
        token: source.token,
      };
    }

    assertDpopHttpBinding(ctx, ctx.state.access, {
      proof: dpopProof,
      scheme: source.kind === "dpop",
    });
    return;
  }

  if (source.kind === "session") {
    const parsed = await extractTokenFromSession(ctx.aegis, source.session);
    if (!parsed) {
      throw new ClientError("Invalid session access token", {
        status: ClientError.Status.Unauthorized,
        code: "invalid_session_access_token",
        type: "urn:lindorm:pylon:error:invalid_session_access_token",
        title: "Invalid Session Access Token",
        details: "No access token could be extracted from the session",
        debug: { sessionId: source.session.id },
      });
    }
    ctx.state.tokens.accessToken = parsed;
    // A cookie-session credential is presented by the browser, not by a DPoP
    // client — there is no proof to bind it to, so no binding check runs (the
    // pre-existing behaviour: the session path never passed a proof to aegis).
    ctx.state.access = {
      provenance: "verified",
      claims: parsed.claims,
      custom: parsed.custom,
      token: source.session.accessToken,
    };
    return;
  }

  throw new ClientError("Invalid credentials", {
    details: "No authorization header or session available",
    status: ClientError.Status.Unauthorized,
    code: "missing_credentials",
    type: "urn:lindorm:pylon:error:missing_credentials",
    title: "Missing Credentials",
    data: { source: source.kind },
  });
};
