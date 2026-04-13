import { ClientError } from "@lindorm/errors";
import {
  PylonAuthRouterConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types";

export const createLogoutCallbackHandler = <C extends PylonHttpContext>(
  routerConfig: PylonAuthRouterConfig,
): PylonHttpMiddleware<C> =>
  async function logoutCallbackHandler(ctx) {
    const cookie = await ctx.cookies.get<PylonLogoutCookie>(routerConfig.cookies.logout);

    if (!cookie) {
      throw new ClientError("No logout cookie found");
    }

    if (cookie.state && cookie.state !== ctx.data.state) {
      throw new ClientError("Invalid state", {
        debug: { cookie, state: ctx.data.state },
      });
    }

    ctx.cookies.del(routerConfig.cookies.logout);

    await ctx.session.del();

    ctx.redirect(cookie.redirectUri);
  };
