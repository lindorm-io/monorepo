import { ClientError } from "@lindorm/errors";
import type { OpenIdAuthorizeRequestQuery } from "@lindorm/types";
import { z } from "zod";
import type {
  PylonAuthRouterConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLoginCookie,
} from "../../../types/index.js";

export const loginSchema = z.object({
  acrValues: z.string().optional(),
  display: z.string().optional(),
  idTokenHint: z.string().optional(),
  loginHint: z.string().optional(),
  maxAge: z.coerce.number().optional(),
  prompt: z.string().optional(),
  redirectUri: z.url().optional(),
  resource: z.string().optional(),
  scope: z.string().optional(),
  uiLocales: z.string().optional(),
});

export const createLoginHandler = (
  routerConfig: PylonAuthRouterConfig,
): PylonHttpMiddleware<PylonHttpContext<OpenIdAuthorizeRequestQuery>> =>
  async function loginHandler(ctx) {
    if (await ctx.cookies.get(routerConfig.cookies.logout)) {
      ctx.cookies.del(routerConfig.cookies.logout);
    }

    const {
      codeChallengeMethod,
      codeVerifier,
      nonce,
      redirect,
      responseType,
      scope,
      state,
    } = ctx.auth.login({
      acrValues: ctx.data.acrValues,
      display: ctx.data.display,
      idTokenHint: ctx.data.idTokenHint,
      loginHint: ctx.data.loginHint,
      maxAge: ctx.data.maxAge,
      prompt: ctx.data.prompt,
      resource: ctx.data.resource,
      scope: ctx.data.scope,
      uiLocales: ctx.data.uiLocales,
    });

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

    const redirectUri = ctx.data.redirectUri || routerConfig.staticRedirect.login;

    if (!redirectUri) {
      throw new ClientError("Redirect URI is required", {
        debug: {
          query: ctx.data.redirectUri,
          config: routerConfig.staticRedirect.login,
        },
      });
    }

    const cookie: PylonLoginCookie = {
      codeChallengeMethod,
      codeVerifier,
      nonce,
      redirectUri,
      responseType,
      scope,
      state,
    };

    await ctx.cookies.set(routerConfig.cookies.login, cookie, {
      encrypted: true,
      httpOnly: true,
      expiry: "15m",
    });

    ctx.redirect(redirect.toString());
  };
