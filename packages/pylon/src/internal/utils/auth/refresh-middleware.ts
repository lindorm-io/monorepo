import { ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import { isDate } from "@lindorm/is";
import type {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
} from "../../../types/index.js";
import {
  PYLON_SESSION_EXPIRES_AT_HEADER,
  PYLON_SESSION_REFRESHED_HEADER,
} from "../../constants/headers.js";
import { parseSessionTokens } from "../parse-session-tokens.js";
import { deploymentCritical } from "../tokens/deployment-critical.js";
import { createAuthDriverContext } from "./create-auth-driver-context.js";
import { parseTokenData } from "./parse-token-data.js";

const getAutoRefresh = (ctx: PylonHttpContext, config: PylonAuthConfig): number => {
  switch (config.refresh.mode) {
    case "force":
      return -1;

    case "half_life": {
      const { expiresAt, issuedAt } = ctx.state.session!;

      if (isDate(expiresAt)) {
        return Math.floor((issuedAt.getTime() + expiresAt.getTime()) / 2);
      }

      // No expiry means no midpoint to have passed, so never refresh on this
      // mode. Substituting `issuedAt` for the missing expiry — as this used to —
      // makes the midpoint `issuedAt` itself, which is always in the past, so
      // `half_life` silently became `force` and hit the token endpoint on every
      // request. `force` already exists for callers who want that.
      return Infinity;
    }

    case "max_age":
      return ctx.state.session!.issuedAt.getTime() + ms(config.refresh.maxAge);

    default:
      throw new ServerError("Invalid refresh mode", {
        code: "invalid_refresh_mode",
        title: "Invalid Refresh Mode",
        type: "urn:lindorm:pylon:error:invalid_refresh_mode",
        details: "config.refresh.mode must be one of: none, force, half_life, max_age",
        data: { mode: config.refresh.mode },
      });
  }
};

export type RefreshMiddlewareConfig = {
  /**
   * What a grant that FAILED means for the session.
   *
   * A failed exchange is ambiguous on its own: the refresh token may genuinely
   * be spent or revoked, or the IdP may simply have been unreachable for the
   * two seconds this request took. The middleware cannot tell those apart —
   * only the MOUNT can say which reading is the safe one, so the mount declares
   * it and the middleware still never learns why it ran.
   *
   * - `true` — the caller asked for a working session and cannot be given one,
   *   so the dead reading is the honest one. `POST /:prefix/refresh`.
   * - `false` (default) — the refresh was opportunistic, riding along a request
   *   that asked for something else. The session is left to expire on its own
   *   terms and the failure is logged; a transient network fault on a read must
   *   not log the user out.
   *
   * Defaulted to `false` deliberately. Deleting a session is destructive and
   * unrecoverable, so it is opt-in: forgetting the flag costs a session that
   * outlives its usefulness until its own expiry, while the opposite default
   * would cost users their session on any blip at the IdP.
   */
  deleteSessionOnFailedGrant?: boolean;
};

export const createRefreshMiddleware = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
  { deleteSessionOnFailedGrant = false }: RefreshMiddlewareConfig = {},
): PylonHttpMiddleware<C> =>
  async function refreshMiddleware(ctx, next) {
    if (!ctx.state.session) {
      throw new ClientError("No active session to refresh", {
        code: "refresh_session_required",
        title: "Refresh Session Required",
        type: "urn:lindorm:pylon:error:refresh_session_required",
        status: ClientError.Status.Unauthorized,
        details: "The refresh middleware requires an authenticated session",
      });
    }

    // Capability wins over policy: a provider with no refresh grant (GitHub
    // classic tokens never expire and cannot be refreshed) says so by omitting
    // the method, and there is no second declaration free to disagree. The
    // configured mode is reported as unhonourable ONCE, at boot.
    if (config.driver.refresh && config.refresh.mode !== "none") {
      const now = Date.now();
      const autoRefresh = getAutoRefresh(ctx, config);

      if (now >= autoRefresh) {
        if (ctx.state.session.refreshToken) {
          try {
            const data = await config.driver.refresh(createAuthDriverContext(ctx), {
              refreshToken: ctx.state.session.refreshToken,
              scope: null,
            });

            ctx.state.session = await parseTokenData(ctx.aegis, data, {
              critical: deploymentCritical(ctx.state.app.config.auth),
              defaultTokenExpiry: config.defaultTokenExpiry,
              session: ctx.state.session,
            });

            await ctx.session.set(ctx.state.session);

            // `ctx.state.tokens` is a PARSE of the session's tokens, done by
            // the session middleware before this ran — so replacing the session
            // without re-deriving them left them describing the token the grant
            // just retired. `ctx.auth.introspect()` / `.userinfo()` answer from
            // those buckets in preference to the session, so `/introspect`
            // reported the replaced token's claims — its `exp` included — for a
            // session that no longer held it.
            await parseSessionTokens(ctx, ctx.state.session);

            // Recorded HERE and only here — one exchange with the token
            // endpoint, one `true`. An opportunistic refresh on `/introspect` or
            // `/userinfo` records the same fact because it IS the same fact.
            ctx.state.sessionRefreshed = true;
          } catch (error) {
            if (deleteSessionOnFailedGrant) {
              ctx.logger.warn("Token refresh failed, deleting session", { error });
              await ctx.session.del();
              ctx.state.session = null;

              // Same invariant on the destructive branch: the buckets described
              // the session this just deleted.
              await parseSessionTokens(ctx, null);
            } else {
              ctx.logger.warn(
                "Token refresh failed, keeping session until its own expiry",
                { error },
              );
            }
          }
        } else {
          // A session established without `offline_access` never receives a
          // refresh token, so there is nothing to exchange. Skipping keeps it
          // alive until its own expiry — attempting the grant would fail, and
          // on a mount that reads a failure as a dead session that would delete
          // a session which was never renewable in the first place.
          ctx.logger.debug("Skipping token refresh, session has no refresh token", {
            sessionId: ctx.state.session.id,
          });
        }
      }
    }

    // The outcome is reported as RESPONSE HEADERS, not as a body field. This
    // middleware runs on `/refresh`, `/introspect`, `/userinfo` and any mount a
    // deployment adds, so the fact is produced on every one of them — but only
    // `/refresh` has a body free to carry it; the others already answer with
    // their own payload. A header reports it uniformly wherever the middleware
    // ran, which is what makes an opportunistic refresh observable at all.
    //
    // `Refreshed` is set unconditionally, so its ABSENCE means "no refresh
    // middleware on this route" rather than "not refreshed" — one reading, not
    // two. `Expires-At` is omitted when there is no deadline to state: a session
    // whose `expiresAt` is null, or one this request destroyed. The header's
    // value space is ISO 8601 and has no spelling for "none"; inventing one
    // (`null`, empty) would be a second thing for every client to parse, while
    // the pair already says it — `Refreshed` present means the middleware ran,
    // `Expires-At` absent means this session carries no deadline.
    ctx.set(PYLON_SESSION_REFRESHED_HEADER, ctx.state.sessionRefreshed.toString());

    if (isDate(ctx.state.session?.expiresAt)) {
      ctx.set(PYLON_SESSION_EXPIRES_AT_HEADER, ctx.state.session.expiresAt.toISOString());
    }

    await next();
  };
