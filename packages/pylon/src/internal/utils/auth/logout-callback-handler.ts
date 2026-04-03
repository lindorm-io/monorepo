import { ClientError } from "@lindorm/errors";
import {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types";

export const createLogoutCallbackHandler = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonHttpMiddleware<C> =>
  async function logoutCallbackHandler(ctx) {
    const cookie = await ctx.cookies.get<PylonLogoutCookie>(config.cookies.logout);

    if (!cookie) {
      throw new ClientError("No logout cookie found");
    }

    if (ctx.data.state && cookie.state !== ctx.data.state) {
      throw new ClientError("Invalid state", {
        debug: { cookie, state: ctx.data.state },
      });
    }

    ctx.cookies.del(config.cookies.logout);

    await ctx.session.del();

    ctx.redirect(cookie.redirectUri);
  };
