import type { DomainAssert, VerifyOptions } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";
import { logResolvedAccess } from "../../internal/utils/access-token/log-resolved-access.js";
import { runHandshakeAccessToken } from "../../internal/utils/access-token/run-handshake-access-token.js";
import { runHttpAccessToken } from "../../internal/utils/access-token/run-http-access-token.js";
import { runSocketAccessToken } from "../../internal/utils/access-token/run-socket-access-token.js";
import {
  isHttpContext,
  isSocketEventContext,
  isSocketHandshakeContext,
} from "../../internal/utils/is-context.js";
import type {
  HandshakeDpopMode,
  PylonAnyContext,
  PylonAnyMiddleware,
  PylonAuthCacheEntry,
} from "../../types/index.js";

export type UseAccessTokenOptions = Omit<DomainAssert & VerifyOptions, "issuer"> & {
  /**
   * Per-mount control of the RFC 7662 introspection cache — tier ONE of the TTL
   * resolution (`cache.ttl` ?? `settings.auth.cache.introspection.ttl` ?? ten
   * seconds), and the sensitive-route carve-out: `cache: false` introspects on
   * EVERY request for this mount even when the deployment enables caching. Only
   * ever narrows; a mount cannot turn a cache on that the deployment did not
   * configure.
   *
   * Handed straight to `ctx.auth.introspect`, which is where the cache lives, so
   * it applies to the HTTP arm — the only one that introspects.
   */
  cache?: PylonAuthCacheEntry;
  /**
   * How strictly the HANDSHAKE treats DPoP (RFC 9449). Defaults to `"optional"`:
   * a bound token must present a valid proof, an unbound one need not.
   * `"required"` rejects any credential that is not bound and proved,
   * `"disabled"` accepts a bound token as a plain bearer.
   *
   * ⚠ Handshake only. On HTTP the scheme states the intent per request — a
   * credential presented as `DPoP` must carry a proof and be bound, one
   * presented as `Bearer` must not be bound — so there is nothing left for a
   * mount-wide mode to decide.
   */
  dpop?: HandshakeDpopMode;
};

/**
 * Resolve the access credential this deployment is a party to, on whichever
 * transport the request arrived by. ONE mount serves all three:
 *
 * - **HTTP** — bearer / DPoP / cookie-session, verified locally when the wire
 *   format is JOSE or COSE and introspected (RFC 7662) when it is opaque.
 * - **Socket handshake** — verifies the credential once and registers the auth
 *   state (strategy, expiry, refresh) the connection then runs on.
 * - **Socket event** — the fast path over that state: it re-checks EXPIRY, not
 *   the signature, and emits `$pylon/auth/expired` once inside the warning
 *   window.
 *
 * ⚠ It takes NO issuer. The issuer is `ctx.state.app.config.auth.issuer`,
 * settled once at boot by amphora for the scope the auth driver named. A
 * per-mount issuer would restate a deployment constant at every mount, free to
 * disagree with the keys verification actually runs against.
 * `createTokenMiddleware({ issuer })` is the DIFFERENT case and keeps its
 * option: it accepts tokens from issuers that are not ours, of which amphora
 * carries an array.
 */
export const useAccessToken = (
  options: UseAccessTokenOptions = {},
): PylonAnyMiddleware => {
  // `cache` and `dpop` are pylon's own knobs and are split off HERE:
  // `splitVerifyInput` routes every key it does not recognise as a verify option
  // into the aegis `assert` bag, where an unknown key is rejected as a claim
  // matcher.
  const { cache, dpop, ...verifyInput } = options;
  const dpopMode: HandshakeDpopMode = dpop ?? "optional";

  return async function useAccessTokenMiddleware(
    ctx: PylonAnyContext,
    next,
  ): Promise<void> {
    const timer = ctx.logger.timer();

    try {
      if (isSocketHandshakeContext(ctx)) {
        await runHandshakeAccessToken(ctx, { dpopMode, verifyInput });
        timer.debug("Access token verified (handshake)", {
          strategy: ctx.io.socket.data.pylon.auth?.strategy,
        });
      } else if (isSocketEventContext(ctx)) {
        const { expiresAt, strategy } = runSocketAccessToken(ctx);
        timer.debug("Access token fast-path accepted", { expiresAt, strategy });
        logResolvedAccess(ctx);
      } else if (isHttpContext(ctx)) {
        await runHttpAccessToken(ctx, { cache, verifyInput });
        timer.debug("Access token verified (http)");
        logResolvedAccess(ctx);
      } else {
        throw new ClientError("Unsupported context for access token middleware", {
          status: ClientError.Status.Unauthorized,
          code: "unsupported_context",
          type: "urn:lindorm:pylon:error:unsupported_context",
          title: "Unsupported Context",
          details:
            "useAccessToken supports HTTP, socket-handshake and socket-event contexts",
        });
      }
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
