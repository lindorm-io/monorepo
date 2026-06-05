import { ClientError } from "@lindorm/errors";
import { z } from "zod";
import type {
  PylonAuthRouterConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLogoutCookie,
} from "../../../types/index.js";

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
      throw new ClientError("No active session to log out", {
        code: "logout_session_required",
        type: "urn:lindorm:pylon:error:logout_session_required",
        status: ClientError.Status.Unauthorized,
        details: "Logout requires an authenticated session",
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
      throw new ClientError("Logout redirect URI is not allowed", {
        code: "logout_redirect_uri_not_allowed",
        type: "urn:lindorm:pylon:error:logout_redirect_uri_not_allowed",
        status: ClientError.Status.BadRequest,
        details:
          "The requested redirect URI origin is not present in the configured dynamicRedirectDomains allowlist",
        data: { redirectUri: ctx.data.redirectUri },
      });
    }

    const { redirect, state } = ctx.auth.logout({
      idTokenHint: ctx.data.idTokenHint ?? ctx.state.session.idToken,
      logoutHint: ctx.data.logoutHint,
      uiLocales: ctx.data.uiLocales,
    });

    const redirectUri = ctx.data.redirectUri || routerConfig.staticRedirect.logout;

    if (!redirectUri) {
      throw new ClientError("Logout redirect URI is required", {
        code: "logout_redirect_uri_required",
        type: "urn:lindorm:pylon:error:logout_redirect_uri_required",
        status: ClientError.Status.BadRequest,
        details:
          "No redirect URI was supplied in the request and no static logout redirect is configured",
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
