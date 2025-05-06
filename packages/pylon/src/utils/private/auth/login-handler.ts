import { ClientError } from "@lindorm/errors";
import { OpenIdAuthorizeRequestQuery } from "@lindorm/types";
import { z } from "zod";
import {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLoginCookie,
} from "../../../types";
import { getAuthClient } from "./get-auth-client";

export const loginSchema = z.object({
  audience: z.string().optional(),
  acrValues: z.string().optional(),
  display: z.string().optional(),
  idTokenHint: z.string().optional(),
  loginHint: z.string().optional(),
  maxAge: z.coerce.number().optional(),
  prompt: z.string().optional(),
  redirectUri: z.string().url().optional(),
  scope: z.string().optional(),
  uiLocales: z.string().optional(),
});

export const createLoginHandler = (
  config: PylonAuthConfig,
): PylonHttpMiddleware<PylonHttpContext<OpenIdAuthorizeRequestQuery>> =>
  async function loginHandler(ctx) {
    if (await ctx.cookies.get(config.cookies.logout)) {
      ctx.cookies.del(config.cookies.logout);
    }

    const client = getAuthClient(ctx, config);

    const {
      codeChallengeMethod,
      codeVerifier,
      nonce,
      redirect,
      responseType,
      scope,
      state,
    } = client.login({
      audience: ctx.data.audience,
      acrValues: ctx.data.acrValues,
      display: ctx.data.display,
      idTokenHint: ctx.data.idTokenHint,
      loginHint: ctx.data.loginHint,
      maxAge: ctx.data.maxAge,
      prompt: ctx.data.prompt,
      scope: ctx.data.scope,
      uiLocales: ctx.data.uiLocales,
    });

    if (
      ctx.data.redirectUri &&
      !config.dynamicRedirectDomains.some((u) => ctx.data.redirectUri.startsWith(u))
    ) {
      throw new ClientError("Invalid redirect URI");
    }

    const redirectUri = ctx.data.redirectUri || config.staticRedirect.login;

    if (!redirectUri) {
      throw new ClientError("Redirect URI is required", {
        debug: {
          query: ctx.data.redirectUri,
          config: config.staticRedirect.login,
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

    await ctx.cookies.set(config.cookies.login, cookie, { expiry: "15m" });

    ctx.redirect(redirect.toString());
  };
