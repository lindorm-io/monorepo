import { isParsedJwt } from "@lindorm/aegis";
import {
  Conduit,
  conduitBearerAuthMiddleware,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
} from "@lindorm/conduit";
import { ClientError } from "@lindorm/errors";
import type { OpenIdAuthorizeResponseQuery, OpenIdClaims } from "@lindorm/types";
import type {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLoginCookie,
} from "../../../types/index.js";
import { parseTokenData } from "./parse-token-data.js";

const resolveSubjectViaUserinfo = (
  ctx: PylonHttpContext,
): ((accessToken: string) => Promise<string | null>) => {
  return async (accessToken: string) => {
    try {
      const config = ctx.amphora.config.find((c) => c.userinfoEndpoint);
      if (!config?.userinfoEndpoint) return null;

      const conduit = new Conduit({
        alias: "auth-userinfo",
        environment: ctx.state.app.environment,
        logger: ctx.logger,
        middleware: [
          conduitCorrelationMiddleware(ctx.state.metadata.correlationId),
          conduitChangeResponseDataMiddleware(),
        ],
      });

      const { data } = await conduit.get<OpenIdClaims>(config.userinfoEndpoint, {
        middleware: [conduitBearerAuthMiddleware(accessToken)],
      });

      return data.sub || null;
    } catch {
      return null;
    }
  };
};

export const createLoginCallbackHandler = (
  config: PylonAuthConfig,
): PylonHttpMiddleware<PylonHttpContext<OpenIdAuthorizeResponseQuery>> => {
  const routerConfig = config.router!;

  return async function loginCallbackHandler(ctx) {
    // RFC 6749 §4.1.2.1 — IdP returned an authorization error response.
    // Clean up the login cookie and redirect to the configured error URL
    // with the error params propagated so the SPA can display them.
    if (ctx.data.error) {
      const loginCookie = await ctx.cookies.get(routerConfig.cookies.login);
      if (loginCookie) {
        ctx.cookies.del(routerConfig.cookies.login);
      }

      const errorUrl = new URL(routerConfig.errorRedirect, ctx.state.origin);
      errorUrl.searchParams.set("error", ctx.data.error);
      if (ctx.data.errorDescription) {
        errorUrl.searchParams.set("error_description", ctx.data.errorDescription);
      }
      if (ctx.data.errorUri) {
        errorUrl.searchParams.set("error_uri", ctx.data.errorUri);
      }
      if (ctx.data.state) {
        errorUrl.searchParams.set("state", ctx.data.state);
      }

      ctx.redirect(errorUrl.toString());
      return;
    }

    const cookie = await ctx.cookies.get<PylonLoginCookie>(routerConfig.cookies.login);

    if (!cookie) {
      throw new ClientError("No login cookie found", {
        code: "login_cookie_missing",
        title: "Login Cookie Missing",
        type: "urn:lindorm:pylon:error:login_cookie_missing",
        status: ClientError.Status.BadRequest,
        details:
          "The login state cookie is absent — the callback was reached without an active login flow, or the cookie expired",
      });
    }

    if (cookie.state && cookie.state !== ctx.data.state) {
      throw new ClientError("Login state mismatch", {
        code: "login_state_mismatch",
        title: "Login State Mismatch",
        type: "urn:lindorm:pylon:error:login_state_mismatch",
        status: ClientError.Status.BadRequest,
        details:
          "The state parameter returned by the IdP does not match the value stored in the login cookie (possible CSRF)",
        debug: { cookie, state: ctx.data.state },
      });
    }

    const resolveSubject = resolveSubjectViaUserinfo(ctx);

    if (cookie.responseType.includes("token")) {
      ctx.state.session = await parseTokenData(ctx.aegis, ctx.data, {
        resolveSubject,
        defaultTokenExpiry: config.defaultTokenExpiry,
      });
    }

    if (cookie.responseType.includes("code") && ctx.data.code) {
      const data = await ctx.auth.token({
        code: ctx.data.code,
        grantType: "authorization_code",
        redirectUri: new URL(
          `${routerConfig.pathPrefix}/login/callback`,
          ctx.state.origin,
        ).toString(),
        codeVerifier: cookie.codeVerifier,
        scope: cookie.scope,
      });

      ctx.state.session = await parseTokenData(ctx.aegis, data, {
        resolveSubject,
        defaultTokenExpiry: config.defaultTokenExpiry,
      });
    }

    if (!ctx.state.session) {
      throw new ClientError("Could not establish session from login callback", {
        code: "login_session_not_established",
        title: "Login Session Not Established",
        type: "urn:lindorm:pylon:error:login_session_not_established",
        status: ClientError.Status.BadRequest,
        details:
          "Neither the token nor code response from the IdP yielded a usable session",
        debug: { responseType: cookie.responseType },
      });
    }

    if (ctx.state.session.idToken) {
      const verified = await ctx.aegis.verify(ctx.state.session.idToken);

      if (
        isParsedJwt(verified) &&
        cookie.nonce &&
        cookie.nonce !== verified.payload.nonce
      ) {
        throw new ClientError("Login nonce mismatch", {
          code: "login_nonce_mismatch",
          title: "Login Nonce Mismatch",
          type: "urn:lindorm:pylon:error:login_nonce_mismatch",
          status: ClientError.Status.BadRequest,
          details:
            "The nonce in the returned id_token does not match the value stored in the login cookie (possible token replay)",
          debug: { cookie, nonce: verified.payload.nonce },
        });
      }
    }

    ctx.cookies.del(routerConfig.cookies.login);

    await ctx.session.set(ctx.state.session);

    ctx.redirect(cookie.redirectUri);
  };
};
