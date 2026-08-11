import { isStructuredToken } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";
import type { AuthorizeResponseQuery } from "@lindorm/openid";
import type {
  PylonAuthConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonLoginCookie,
} from "../../../types/index.js";
import { redactLoginCookie } from "../redact/redact-login-cookie.js";
import { createAuthDriverContext } from "./create-auth-driver-context.js";
import { parseTokenData } from "./parse-token-data.js";

export const createLoginCallbackHandler = (
  config: PylonAuthConfig,
): PylonHttpMiddleware<PylonHttpContext<AuthorizeResponseQuery>> => {
  const routerConfig = config.router!;

  return async function loginCallbackHandler(ctx) {
    // RFC 6749 §4.1.2.1 — IdP returned an authorization error response.
    // Clean up the login cookie and redirect to the configured error URL
    // with the error params propagated so the SPA can display them.
    if (ctx.data.error) {
      const loginCookie = await ctx.cookies.get(routerConfig.cookies.login, {
        signed: true,
        encrypted: true,
      });
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

    // Read under the SAME policy the login handler wrote: signature verified and
    // decryption enforced BEFORE any of state/redirectUri/codeVerifier/nonce is
    // trusted. A forged (unsigned or unsealed) cookie is rejected here, not by a
    // downstream guard reading attacker-controlled values.
    const cookie = await ctx.cookies.get<PylonLoginCookie>(routerConfig.cookies.login, {
      signed: true,
      encrypted: true,
    });

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
        debug: { cookie: redactLoginCookie(cookie), state: ctx.data.state },
      });
    }

    const driverContext = createAuthDriverContext(ctx);

    // An OPAQUE access token carries no subject pylon can read. The driver is the
    // only party that knows how to ask its provider — a GitHub or Discord login
    // completes on this alone, having no id_token at all. Best effort by
    // contract: it returns `null` rather than throwing, and `parseTokenData`
    // only fails once every provenance has come back empty.
    const resolveSubject = config.driver.subject
      ? (accessToken: string) => config.driver.subject!(driverContext, { accessToken })
      : undefined;

    if (cookie.responseType.includes("token")) {
      ctx.state.session = await parseTokenData(ctx.aegis, ctx.data, {
        resolveSubject,
        defaultTokenExpiry: config.defaultTokenExpiry,
      });
    }

    if (cookie.responseType.includes("code") && ctx.data.code) {
      if (!config.driver.exchange) {
        throw new ServerError("Auth driver cannot exchange an authorization code", {
          code: "driver_cannot_exchange",
          title: "Auth Driver Cannot Exchange",
          type: "urn:lindorm:pylon:error:driver_cannot_exchange",
          details:
            "The configured auth driver implements no `exchange` method, so the authorization code cannot be redeemed",
        });
      }

      const data = await config.driver.exchange(driverContext, {
        code: ctx.data.code,
        codeVerifier: cookie.codeVerifier,
        // ⚠ The SAME string the authorization request carried, replayed from the
        // cookie rather than rebuilt — RFC 6749 §4.1.3 requires an exact match.
        redirectUri: cookie.callbackUri,
        scope: cookie.scope || null,
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

      // ⚠ This gate is NEGATIVE — the throw only fires for a token it admits, so
      // a format it does not admit skips the replay check ENTIRELY. Under
      // `format === "jwt"` a CWT or encrypted id_token carried its nonce past
      // this test unexamined. `claims.nonce` is domain-keyed and present on both
      // wires, so the check applies to every claims-bearing id_token.
      if (
        isStructuredToken(verified) &&
        cookie.nonce &&
        cookie.nonce !== verified.claims.nonce
      ) {
        throw new ClientError("Login nonce mismatch", {
          code: "login_nonce_mismatch",
          title: "Login Nonce Mismatch",
          type: "urn:lindorm:pylon:error:login_nonce_mismatch",
          status: ClientError.Status.BadRequest,
          details:
            "The nonce in the returned id_token does not match the value stored in the login cookie (possible token replay)",
          debug: { cookie: redactLoginCookie(cookie), nonce: verified.claims.nonce },
        });
      }
    }

    ctx.cookies.del(routerConfig.cookies.login);

    await ctx.session.set(ctx.state.session);

    ctx.redirect(cookie.redirectUri);
  };
};
