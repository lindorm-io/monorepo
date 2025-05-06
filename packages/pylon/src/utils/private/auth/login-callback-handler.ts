import { Aegis, ParsedJwt } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { OpenIdAuthorizeResponseQuery } from "@lindorm/types";
import {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLoginCookie,
} from "../../../types";
import { getAuthClient } from "./get-auth-client";
import { parseTokenData } from "./parse-token-data";

export const createLoginCallbackHandler = (
  config: PylonAuthConfig,
): PylonHttpMiddleware<PylonHttpContext<OpenIdAuthorizeResponseQuery>> =>
  async function loginCallbackHandler(ctx) {
    const cookie = await ctx.cookies.get<PylonLoginCookie>(config.cookies.login);

    if (!cookie) {
      throw new ClientError("No login cookie found");
    }

    if (ctx.data.state && cookie.state !== ctx.data.state) {
      throw new ClientError("Invalid state", {
        debug: { cookie, state: ctx.data.state },
      });
    }

    if (cookie.responseType.includes("token")) {
      ctx.state.session = parseTokenData(ctx, config, ctx.data);
    }

    if (cookie.responseType.includes("code") && ctx.data.code) {
      const { audience } = config.defaults;

      const client = getAuthClient(ctx, config);

      const data = await client.token({
        ...(audience && { audience }),
        code: ctx.data.code,
        grantType: "authorization_code",
        redirectUri: new URL("/auth/login/callback", ctx.request.origin).toString(),
        codeVerifier: cookie.codeVerifier,
        scope: cookie.scope,
      });

      ctx.state.session = parseTokenData(ctx, config, data);
    }

    if (!ctx.state.session) {
      throw new ClientError("No session found");
    }

    if (ctx.state.session.idToken) {
      const parsed = Aegis.parse<ParsedJwt>(ctx.state.session.idToken);

      if (parsed.payload.nonce && cookie.nonce !== parsed.payload.nonce) {
        throw new ClientError("Invalid nonce", {
          debug: { cookie, nonce: parsed.payload.nonce },
        });
      }
    }

    if (!ctx.state.session.subject?.length) {
      const userinfo = await getAuthClient(ctx, config).userinfo(
        ctx.state.session.accessToken,
      );

      ctx.state.session.subject = userinfo.sub;
    }

    ctx.cookies.del(config.cookies.login);

    await ctx.session.set(ctx.state.session);

    ctx.redirect(cookie.redirectUri);
  };
