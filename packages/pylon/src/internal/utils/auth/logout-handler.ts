import { ClientError } from "@lindorm/errors";
import { z } from "zod/v4";
import {
  PylonAuthRouterConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types";

export const logoutSchema = z.object({
  idTokenHint: z.string().optional(),
  logoutHint: z.string().optional(),
  redirectUri: z.url().optional(),
  uiLocales: z.string().optional(),
});

export const createLogoutHandler = <C extends PylonHttpContext>(
  routerConfig: PylonAuthRouterConfig,
): PylonHttpMiddleware<C> =>
  async function logoutHandler(ctx) {
    if (await ctx.cookies.get(routerConfig.cookies.login)) {
      ctx.cookies.del(routerConfig.cookies.login);
    }

    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    if (
      ctx.data.redirectUri &&
      !routerConfig.dynamicRedirectDomains.some((u) => {
        try {
          return new URL(ctx.data.redirectUri).origin === new URL(u).origin;
        } catch {
          return false;
        }
      })
    ) {
      throw new ClientError("Invalid redirect URI");
    }

    const { redirect, state } = ctx.auth.logout({
      idTokenHint: ctx.data.idTokenHint ?? ctx.state.session.idToken,
      logoutHint: ctx.data.logoutHint,
      uiLocales: ctx.data.uiLocales,
    });

    const redirectUri = ctx.data.redirectUri || routerConfig.staticRedirect.logout;

    if (!redirectUri) {
      throw new ClientError("Redirect URI is required", {
        debug: {
          query: ctx.data.redirectUri,
          config: routerConfig.staticRedirect.logout,
        },
      });
    }

    const cookie: PylonLogoutCookie = {
      redirectUri,
      state,
    };

    await ctx.cookies.set(routerConfig.cookies.logout, cookie, { expiry: "15m" });

    ctx.redirect(redirect.toString());
  };
