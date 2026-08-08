import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

/**
 * `POST /:prefix/refresh` answers `204` with no body.
 *
 * What happened is reported by the refresh MIDDLEWARE, on
 * `X-Pylon-Session-Refreshed` and `X-Pylon-Session-Expires-At`. It has to be:
 * the same middleware runs on `/introspect`, `/userinfo` and any mount a
 * deployment adds, and those routes have no body to spare — they answer with
 * their own payload. A body field would have made the outcome readable on
 * exactly one of the routes that produce it.
 *
 * So this handler exists for ONE thing the headers cannot say: whether there is
 * still a session at all. A grant that fails on this route destroys it (the
 * caller asked for a working session and cannot be given one), and answering
 * `204` for that would report success for a request that left the user logged
 * out. It answers the same `refresh_session_required` the middleware throws when
 * no session was presented to begin with — after this request there is none
 * either way.
 */
export const createRefreshHandler = <
  C extends PylonHttpContext,
>(): PylonHttpMiddleware<C> =>
  async function refreshHandler(ctx) {
    if (!ctx.state.session) {
      throw new ClientError("No active session to refresh", {
        code: "refresh_session_required",
        title: "Refresh Session Required",
        type: "urn:lindorm:pylon:error:refresh_session_required",
        status: ClientError.Status.Unauthorized,
        details: "The refresh endpoint requires an authenticated session",
      });
    }

    ctx.status = 204;
  };
