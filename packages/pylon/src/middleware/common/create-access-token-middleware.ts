import { Aegis, type DomainAssert, type VerifyOptions } from "@lindorm/aegis";
import type { ReadableTime } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import { DEFAULT_AUTH_WARNING_MS } from "../../internal/constants/auth.js";
import { introspectWithCache } from "../../internal/utils/introspection/introspect-with-cache.js";
import { isInExpiryWarningWindow } from "../../internal/utils/auth-state/is-in-expiry-warning-window.js";
import { isTokenExpired } from "../../internal/utils/auth-state/is-token-expired.js";
import { markAuthExpiredEmitted } from "../../internal/utils/auth-state/mark-auth-expired-emitted.js";
import { shouldEmitAuthExpired } from "../../internal/utils/auth-state/should-emit-auth-expired.js";
import { assertDpopHttpBinding } from "../../internal/utils/dpop/assert-dpop-http-binding.js";
import {
  isHttpContext,
  isSocketEventContext,
  isSocketHandshakeContext,
} from "../../internal/utils/is-context.js";
import { extractTokenFromSession } from "../../internal/utils/tokens/extract-token-from-session.js";
import { resolveHttpTokenSource } from "../../internal/utils/tokens/resolve-http-token-source.js";
import { splitVerifyInput } from "../../internal/utils/tokens/split-verify-input.js";
import type {
  PylonContext,
  PylonHttpContext,
  PylonMiddleware,
  PylonResolvedAccess,
} from "../../types/index.js";

type Options = Omit<DomainAssert & VerifyOptions, "issuer"> & {
  issuer: string;
  /**
   * Per-mount control of the RFC 7662 introspection cache — tier ONE of the TTL
   * resolution (`cache.ttl` ?? `settings.introspection.ttl` ?? ten seconds), and
   * the sensitive-route carve-out: `cache: false` introspects on EVERY request
   * for this mount even when the deployment enables caching. Only ever narrows;
   * a mount cannot turn a cache on that the deployment did not configure.
   */
  cache?: false | { ttl?: ReadableTime };
};

/**
 * Is this credential one aegis can verify locally? SNIFFED from the wire format,
 * never discovered by attempting a verify and treating the failure as "must be
 * opaque" — a tampered JWT must FAIL, not fall through to introspection where an
 * authorization server would be asked about a string it never issued.
 *
 * `Aegis.isJose` / `Aegis.isCose` are the same structural discriminators
 * `aegis.verify` itself dispatches on (`internal/utils/verify-token.ts`), so this
 * predicate is exactly congruent with "verify can select a kit for it": anything
 * it accepts, verify will process; anything it rejects, verify would refuse with
 * `unsupported_token_type`.
 */
const isLocallyVerifiable = (token: string): boolean =>
  Aegis.isJose(token) || Aegis.isCose(token);

type VerifyInput = Omit<Options, "cache">;

const runHttp = async (
  ctx: PylonHttpContext,
  options: VerifyInput,
  cache: Options["cache"],
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
        ...options,
        trustBoundThumbprint: true,
      } as DomainAssert & VerifyOptions);

      const verified = await ctx.aegis.verify(source.token, assert, verifyOptions);

      ctx.state.tokens.accessToken = verified;
      ctx.state.access = {
        provenance: "verified",
        claims: verified.claims,
        token: source.token,
      };
    } else {
      // Opaque ⇒ the authorization server is the only authority on it (RFC 7662).
      // ONE introspection call site, so swapping the resolver is a one-line
      // change. The cache in front of it is short-lived by construction — the
      // TTL is the revocation window (RFC 7662 §5) — and steps aside entirely
      // when the deployment configured none.
      const introspection = await introspectWithCache(ctx, source.token, cache);

      if (!introspection.active) {
        throw new ClientError("Access token is not active", {
          status: ClientError.Status.Unauthorized,
          code: "token_not_active",
          type: "urn:lindorm:pylon:error:token_not_active",
          title: "Token Not Active",
          details: "Token introspection returned active: false",
        });
      }

      const { active: _active, ...claims } = introspection;

      // `ctx.state.tokens.accessToken` is deliberately left UNSET here: there is
      // no VerifiedToken, and synthesising one would erase the very provenance
      // distinction `ctx.state.access` exists to preserve.
      ctx.state.access = { provenance: "introspected", claims, token: source.token };
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

export const createAccessTokenMiddleware = <C extends PylonContext = PylonContext>(
  options: Options,
): PylonMiddleware<C> => {
  // `cache` is pylon's own knob and is split off HERE: `splitVerifyInput` routes
  // every key it does not recognise as a verify option into the aegis `assert`
  // bag, where an unknown key is rejected as a claim matcher.
  const { cache, ...verifyInput } = options;

  return async function accessTokenMiddleware(ctx, next): Promise<void> {
    const timer = ctx.logger.timer();

    try {
      if (isSocketHandshakeContext(ctx as any)) {
        throw new ServerError(
          "createAccessTokenMiddleware cannot run in the handshake phase",
          {
            code: "access_token_middleware_in_handshake",
            type: "urn:lindorm:pylon:error:access_token_middleware_in_handshake",
            title: "Access Token Middleware in Handshake",
            details:
              "Use createHandshakeTokenMiddleware in socket.connectionMiddleware for the handshake phase",
          },
        );
      }

      if (isSocketEventContext(ctx as any)) {
        const socket = (ctx as any).io.socket;
        const auth = socket.data?.pylon?.auth;

        if (!auth) {
          throw new ClientError("Invalid credentials", {
            details:
              "No handshake auth state — install createHandshakeTokenMiddleware in socket.connectionMiddleware",
            status: ClientError.Status.Unauthorized,
            code: "missing_handshake_auth_state",
            type: "urn:lindorm:pylon:error:missing_handshake_auth_state",
            title: "Missing Handshake Auth State",
          });
        }

        const expiresAt = auth.getExpiresAt();
        const now = new Date();

        if (isTokenExpired(expiresAt, now)) {
          throw new ClientError("Access token expired", {
            status: ClientError.Status.Unauthorized,
            code: "access_token_expired",
            type: "urn:lindorm:pylon:error:access_token_expired",
            title: "Access Token Expired",
            data: { expiresAt: expiresAt.toISOString() },
            debug: { strategy: auth.strategy },
          });
        }

        if (
          isInExpiryWarningWindow(expiresAt, now, DEFAULT_AUTH_WARNING_MS) &&
          shouldEmitAuthExpired(auth, now)
        ) {
          socket.emit("$pylon/auth/expired", { expiresAt });
          markAuthExpiredEmitted(auth, now);
        }

        const bearer = socket.data.tokens.bearer;
        (ctx as any).state.tokens.accessToken = bearer;
        // Verified at handshake by createHandshakeTokenMiddleware; the fast path
        // re-checks expiry, not the signature — provenance is still local.
        (ctx as any).state.access = {
          provenance: "verified",
          claims: bearer.claims,
          token: bearer.token,
        } satisfies PylonResolvedAccess;
        timer.debug("Access token fast-path accepted", {
          expiresAt,
          strategy: auth.strategy,
        });
      } else if (isHttpContext(ctx as any)) {
        await runHttp(ctx as unknown as PylonHttpContext, verifyInput, cache);
        timer.debug("Access token verified (http)");
      } else {
        throw new ClientError("Unsupported context for access token middleware", {
          status: ClientError.Status.Unauthorized,
          code: "unsupported_context",
          type: "urn:lindorm:pylon:error:unsupported_context",
          title: "Unsupported Context",
          details:
            "createAccessTokenMiddleware only supports HTTP and socket-event contexts",
        });
      }

      // Read from `access`, not `tokens.accessToken` — the introspected path
      // populates only the former.
      const access = (ctx as any).state.access as PylonResolvedAccess | null;
      ctx.logger.debug("Access token resolved", {
        provenance: access?.provenance,
        subject: access?.claims?.subject,
        subjectHint: access?.claims?.subjectHint,
      });
    } catch (error: any) {
      timer.debug("Access token verification failed", error);

      if (error instanceof ClientError || error instanceof ServerError) {
        throw error;
      }

      throw new ClientError("Access token verification failed", {
        error,
        status: ClientError.Status.Unauthorized,
        code: "access_token_verification_failed",
        type: "urn:lindorm:pylon:error:access_token_verification_failed",
        title: "Access Token Verification Failed",
        details: error.message,
      });
    }

    await next();
  };
};
