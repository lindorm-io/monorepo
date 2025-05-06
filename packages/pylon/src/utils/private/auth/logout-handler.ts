import { ClientError } from "@lindorm/errors";
import { z } from "zod";
import {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types";
import { getAuthClient } from "./get-auth-client";

export const logoutSchema = z.object({
  idTokenHint: z.string().optional(),
  logoutHint: z.string().optional(),
  redirectUri: z.string().url().optional(),
});

export const createLogoutHandler = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonHttpMiddleware<C> =>
  async function logoutHandler(ctx) {
    if (await ctx.cookies.get(config.cookies.login)) {
      ctx.cookies.del(config.cookies.login);
    }

    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    if (
      ctx.data.redirectUri &&
      !config.dynamicRedirectDomains.some((u) => ctx.data.redirectUri.startsWith(u))
    ) {
      throw new ClientError("Invalid redirect URI");
    }

    const client = getAuthClient(ctx, config);

    const { redirect, state } = client.logout({
      idTokenHint: ctx.data.idTokenHint ?? ctx.state.session.idToken,
      logoutHint: ctx.data.logoutHint,
      uiLocales: ctx.data.uiLocales,
    });

    const redirectUri = ctx.data.redirectUri || config.staticRedirect.logout;

    if (!redirectUri) {
      throw new ClientError("Redirect URI is required", {
        debug: {
          query: ctx.data.redirectUri,
          config: config.staticRedirect.logout,
        },
      });
    }

    const cookie: PylonLogoutCookie = {
      redirectUri,
      state,
    };

    await ctx.cookies.set(config.cookies.logout, cookie, { expiry: "15m" });

    ctx.redirect(redirect.toString());
  };
