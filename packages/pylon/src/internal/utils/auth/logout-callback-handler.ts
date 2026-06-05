import { ClientError } from "@lindorm/errors";
import type {
  PylonAuthRouterConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types/index.js";

export const createLogoutCallbackHandler = <C extends PylonHttpContext>(
  routerConfig: PylonAuthRouterConfig,
): PylonHttpMiddleware<C> =>
  async function logoutCallbackHandler(ctx) {
    const cookie = await ctx.cookies.get<PylonLogoutCookie>(routerConfig.cookies.logout);

    if (!cookie) {
      throw new ClientError("No logout cookie found", {
        code: "logout_cookie_missing",
        type: "urn:lindorm:pylon:error:logout_cookie_missing",
        status: ClientError.Status.BadRequest,
        details:
          "The logout state cookie is absent — the callback was reached without an active logout flow, or the cookie expired",
      });
    }

    if (cookie.state && cookie.state !== ctx.data.state) {
      throw new ClientError("Logout state mismatch", {
        code: "logout_state_mismatch",
        type: "urn:lindorm:pylon:error:logout_state_mismatch",
        status: ClientError.Status.BadRequest,
        details:
          "The state parameter returned by the IdP does not match the value stored in the logout cookie (possible CSRF)",
        debug: { cookie, state: ctx.data.state },
      });
    }

    ctx.cookies.del(routerConfig.cookies.logout);

    await ctx.session.del();

    ctx.redirect(cookie.redirectUri);
  };
