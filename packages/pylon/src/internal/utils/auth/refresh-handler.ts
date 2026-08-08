import { ClientError } from "@lindorm/errors";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../../types/index.js";

/**
 * Reports what the refresh middleware in front of it DID.
 *
 * The route used to answer `204` with an empty body whether the session was
 * refreshed or skipped entirely, which made the endpoint unusable for the one
 * question it exists to answer: when do I call again, and when do I have to send
 * the user back to the IdP? `expiresAt` is that answer, and it is worth returning
 * on success too — otherwise a client has to infer the new lifetime from
 * configuration it does not hold.
 *
 * Three outcomes, three distinct answers:
 *
 * - refreshed ⇒ `200 { refreshed: true, expiresAt }` — the NEW expiry.
 * - skipped ⇒ `200 { refreshed: false, expiresAt }` — the ORIGINAL expiry still
 *   stands. A session without a refresh token (no `offline_access`) is the
 *   common case; it is alive, just not renewable.
 * - the grant FAILED ⇒ the middleware deleted the session, so `401`. It cannot
 *   be `200 { refreshed: false, expiresAt: null }`: a live session with no
 *   deadline reports exactly that, and a caller that must choose between calling
 *   again and re-authenticating cannot be handed one body for both. The same
 *   `refresh_session_required` the middleware throws when there was no session to
 *   begin with — after this request there is none either way.
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

    ctx.body = {
      refreshed: ctx.state.sessionRefreshed,
      expiresAt: ctx.state.session.expiresAt,
    };
    ctx.status = 200;
  };
