import {
  Conduit,
  conduitBasicAuthMiddleware,
  conduitBearerAuthMiddleware,
  conduitChangeRequestBodyMiddleware,
  conduitChangeRequestQueryMiddleware,
  conduitChangeResponseDataMiddleware,
  conduitCorrelationMiddleware,
} from "@lindorm/conduit";
import { sec } from "@lindorm/date";
import type { IConduit } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { isArray, isNumberString, isString } from "@lindorm/is";
import { PKCE } from "@lindorm/pkce";
import type {
  OpenIdAuthorizeRequestQuery,
  OpenIdClaims,
  OpenIdIntrospectResponse,
  OpenIdLogoutRequest,
  OpenIdTokenRequest,
  OpenIdTokenResponse,
} from "@lindorm/types";
import { createUrl } from "@lindorm/url";
import { merge, sortKeys } from "@lindorm/utils";
import { randomBytes } from "crypto";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import type {
  AuthorizeQuery,
  AuthorizeResult,
  LogoutQuery,
  LogoutResult,
  PylonAuthClient,
  PylonAuthClaimsClient,
  PylonAuthConfig,
  PylonContext,
  PylonHttpContext,
  PylonIntrospection,
  PylonIntrospectionActive,
  PylonUserinfo,
  TokenRequest,
} from "../../../types/index.js";
import { getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { parseIntrospection } from "./parse-introspection.js";
import { parseUserinfo } from "./parse-userinfo.js";
import type { PartialOpenIdConfiguration } from "./types.js";

/**
 * OIDC Discovery §3 / RFC 8414 §2 — `token_endpoint_auth_methods_supported` is
 * OPTIONAL, and when it is omitted the spec default is `client_secret_basic`.
 */
const DEFAULT_TOKEN_ENDPOINT_AUTH_METHODS: Array<string> = ["client_secret_basic"];

// --- Claims client (works on both HTTP and socket) ---

type ClaimsClientOptions = {
  ctx: PylonContext;
  config: PylonAuthConfig;
  conduit: IConduit;
  openid: PartialOpenIdConfiguration;
  resolveAccessToken: () => string | null;
};

export const createClaimsClient = (
  options: ClaimsClientOptions,
): PylonAuthClaimsClient => {
  const { ctx, config, conduit, openid, resolveAccessToken } = options;

  // Per-token caches: the empty string sentinel "" is the no-arg /
  // context-resolved-token entry. Explicit tokens are keyed by their value.
  const userinfoCache = new Map<string, PylonUserinfo>();
  const introspectCache = new Map<string, PylonIntrospection>();

  const userinfo = async (token?: string): Promise<PylonUserinfo> => {
    const cacheKey = token ?? "";
    const cached = userinfoCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify (id_token-style JWT).
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (verified.format === "jwt") {
          const result = parseUserinfo(verified.wire?.payload ?? {});
          userinfoCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to endpoint with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed id_token from context if available.
      const idToken = ctx.state.tokens?.idToken;
      if (idToken && idToken.format === "jwt") {
        const result = parseUserinfo(idToken.wire?.payload ?? {});
        userinfoCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new UserinfoEndpointFailed("No access token available for userinfo request", {
        code: "userinfo_access_token_missing",
        title: "Userinfo Access Token Missing",
        details:
          "No explicit token was provided and none could be resolved from the session, authorization header, or context",
      });
    }

    // `userinfo_endpoint` is only RECOMMENDED (OIDC Discovery §3) — an OP that omits
    // it cannot serve this call at all. Fail by name instead of requesting `undefined`.
    if (!isString(openid.userinfoEndpoint)) {
      throw new ServerError("IdP does not support the userinfo endpoint", {
        code: "idp_userinfo_endpoint_not_supported",
        title: "IdP Userinfo Endpoint Not Supported",
        type: "urn:lindorm:pylon:error:idp_userinfo_endpoint_not_supported",
        status: ServerError.Status.NotImplemented,
        details:
          "The upstream IdP's discovery document publishes no `userinfo_endpoint` (RECOMMENDED, not REQUIRED, by OIDC Discovery §3), so userinfo cannot be fetched from the IdP. Supply the endpoint through the amphora `idp.openIdConfiguration` override if the IdP serves one without advertising it.",
        data: { issuer: config.issuer },
      });
    }

    try {
      const { data } = await conduit.get<OpenIdClaims>(openid.userinfoEndpoint, {
        middleware: [conduitBearerAuthMiddleware(accessToken)],
      });

      const result = parseUserinfo(data);
      userinfoCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw new UserinfoEndpointFailed(
        error instanceof Error ? error.message : "Userinfo endpoint request failed",
        {
          code: "userinfo_endpoint_failed",
          title: "Userinfo Endpoint Failed",
          details:
            "The request to the IdP userinfo endpoint did not complete successfully; see the userinfoEndpoint in error data",
          data: { userinfoEndpoint: openid.userinfoEndpoint },
          debug: { error },
        },
      );
    }
  };

  const introspect = async (token?: string): Promise<PylonIntrospection> => {
    const cacheKey = token ?? "";
    const cached = introspectCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify first.
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (verified.format === "jwt") {
          const result: PylonIntrospectionActive = { ...verified.claims, active: true };
          introspectCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to endpoint with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed access token from context if available.
      const accessTokenParsed = ctx.state.tokens?.accessToken;
      if (accessTokenParsed && accessTokenParsed.format === "jwt") {
        // The domain `claims` bucket holds only the registered claims — the
        // custom-claim and profile buckets are kept separate on VerifiedToken,
        // so introspection sees neither. `confirmation` IS a registered claim
        // (PopClaims) and passes through.
        const result: PylonIntrospectionActive = {
          ...accessTokenParsed.claims,
          active: true,
        };
        introspectCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new IntrospectionEndpointFailed(
        "No access token available for introspection request",
        {
          code: "introspect_access_token_missing",
          title: "Introspect Access Token Missing",
          details:
            "No explicit token was provided and none could be resolved from the session, authorization header, or context",
        },
      );
    }

    // `introspection_endpoint` is OPTIONAL (RFC 8414 §2) and real OPs omit it —
    // Auth0 publishes none. Fail by name instead of posting to `undefined`.
    if (!isString(openid.introspectionEndpoint)) {
      throw new ServerError("IdP does not support the introspection endpoint", {
        code: "idp_introspection_endpoint_not_supported",
        title: "IdP Introspection Endpoint Not Supported",
        type: "urn:lindorm:pylon:error:idp_introspection_endpoint_not_supported",
        status: ServerError.Status.NotImplemented,
        details:
          "The upstream IdP's discovery document publishes no `introspection_endpoint` (OPTIONAL per RFC 8414), so the token cannot be introspected remotely. Use locally verifiable JWT access tokens, or supply the endpoint through the amphora `idp.openIdConfiguration` override.",
        data: { issuer: config.issuer },
      });
    }

    try {
      const { data } = await conduit.post<OpenIdIntrospectResponse>(
        openid.introspectionEndpoint,
        {
          body: { token: accessToken },
          middleware: [conduitBasicAuthMiddleware(config.clientId, config.clientSecret)],
        },
      );

      const result = parseIntrospection(data);
      introspectCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw new IntrospectionEndpointFailed(
        error instanceof Error ? error.message : "Introspection endpoint request failed",
        {
          code: "introspect_endpoint_failed",
          title: "Introspect Endpoint Failed",
          details:
            "The request to the IdP introspection endpoint did not complete successfully; see the introspectionEndpoint in error data",
          data: { introspectionEndpoint: openid.introspectionEndpoint },
          debug: { error },
        },
      );
    }
  };

  return { introspect, userinfo };
};

// --- Full auth client (HTTP only — adds login/logout/token) ---

export const createAuthClient = (
  ctx: PylonHttpContext,
  config: PylonAuthConfig,
): PylonAuthClient => {
  const openid = getOpenIdConfiguration(ctx, config);

  const conduit = new Conduit({
    alias: "auth",
    environment: ctx.state.app.environment,
    logger: ctx.logger,
    middleware: [
      conduitCorrelationMiddleware(ctx.state.metadata.correlationId),
      conduitChangeRequestBodyMiddleware(),
      conduitChangeRequestQueryMiddleware(),
      conduitChangeResponseDataMiddleware(),
    ],
  });

  const claims = createClaimsClient({
    ctx,
    config,
    conduit,
    openid,
    resolveAccessToken: () =>
      ctx.state.session?.accessToken ?? ctx.state.authorization?.value ?? null,
  });

  const login = (input: AuthorizeQuery = {}): AuthorizeResult => {
    if (!config.router) {
      throw new ServerError("Auth router is not configured", {
        code: "auth_router_not_configured",
        title: "Auth Router Not Configured",
        type: "urn:lindorm:pylon:error:auth_router_not_configured",
        details:
          "ctx.auth.login() requires options.auth.router to be configured on the Pylon",
      });
    }

    const {
      method: codeChallengeMethod,
      challenge: codeChallenge,
      verifier: codeVerifier,
    } = PKCE.create(config.router.authorize.codeChallengeMethod);

    const { clientId } = config;
    const { acrValues, prompt, resource, responseType, scope } = config.router.authorize;
    const { resourceKey } = config.router;
    const maxAge = isNumberString(input.maxAge)
      ? input.maxAge.toString()
      : config.router.authorize.maxAge
        ? sec(config.router.authorize.maxAge).toString()
        : undefined;

    const code = responseType.includes("code");
    const nonce = randomBytes(16).toString("base64url");
    const state = randomBytes(16).toString("base64url");

    const authorize: OpenIdAuthorizeRequestQuery = {
      clientId,
      nonce,
      redirectUri: new URL(
        `${config.router.pathPrefix}/login/callback`,
        ctx.state.origin,
      ).toString(),
      responseType,
      scope: scope.join(" "),
      state,
      ...(acrValues && { acrValues }),
      ...(resource && { resource }),
      ...(code && { codeChallenge, codeChallengeMethod }),
      ...(maxAge && { maxAge }),
      ...(prompt && { prompt }),
    };

    const merged = merge<OpenIdAuthorizeRequestQuery>(authorize, input);

    // The config field is always named `resource`, but the wire param
    // is named per `resourceKey` — Auth0 tenants without the RFC 8707
    // compatibility profile still require the proprietary `audience`
    // parameter to issue a JWT access token.
    if (resourceKey === "audience" && merged.resource) {
      merged.audience = merged.resource;
      delete merged.resource;
    }

    const query = sortKeys(merged);

    const redirect = createUrl(openid.authorizationEndpoint, {
      query,
      changeQueryCase: "snake",
    });

    return {
      codeChallengeMethod,
      codeVerifier,
      nonce,
      redirect,
      responseType: query.responseType,
      scope: query.scope,
      state,
    };
  };

  const logout = (input: LogoutQuery = {}): LogoutResult => {
    if (!config.router) {
      throw new ServerError("Auth router is not configured", {
        code: "auth_router_not_configured",
        title: "Auth Router Not Configured",
        type: "urn:lindorm:pylon:error:auth_router_not_configured",
        details:
          "ctx.auth.logout() requires options.auth.router to be configured on the Pylon",
      });
    }

    // `end_session_endpoint` is OPTIONAL (OIDC RP-Initiated Logout 1.0 §2) — an OP
    // that omits it has no RP-initiated logout to redirect to.
    if (!isString(openid.endSessionEndpoint)) {
      throw new ServerError("IdP does not support the end session endpoint", {
        code: "idp_end_session_endpoint_not_supported",
        title: "IdP End Session Endpoint Not Supported",
        type: "urn:lindorm:pylon:error:idp_end_session_endpoint_not_supported",
        status: ServerError.Status.NotImplemented,
        details:
          "The upstream IdP's discovery document publishes no `end_session_endpoint` (OPTIONAL per OIDC RP-Initiated Logout 1.0), so the user cannot be redirected to the IdP for logout. Clear the local session only, or supply the endpoint through the amphora `idp.openIdConfiguration` override.",
        data: { issuer: config.issuer },
      });
    }

    const { clientId } = config;

    const state = randomBytes(16).toString("base64url");

    const logoutRequest: OpenIdLogoutRequest = {
      clientId,
      postLogoutRedirectUri: new URL(
        `${config.router.pathPrefix}/logout/callback`,
        ctx.state.origin,
      ).toString(),
      state,
    };

    const redirect = createUrl(openid.endSessionEndpoint, {
      query: sortKeys(merge(logoutRequest, input)),
      changeQueryCase: "snake",
    });

    return { redirect, state };
  };

  const token = async (input: TokenRequest): Promise<OpenIdTokenResponse> => {
    const { clientId, clientSecret } = config;

    // Absent ⇒ the spec default, so an OP that advertises nothing still gets the
    // basic-auth credentials it is entitled to expect.
    const authMethods = isArray(openid.tokenEndpointAuthMethodsSupported)
      ? openid.tokenEndpointAuthMethodsSupported
      : DEFAULT_TOKEN_ENDPOINT_AUTH_METHODS;

    const clientPost = authMethods.includes("client_secret_post")
      ? {
          clientId,
          clientSecret,
        }
      : null;

    const middleware = authMethods.includes("client_secret_basic")
      ? [conduitBasicAuthMiddleware(clientId, clientSecret)]
      : [];

    const tokenRequest: Omit<OpenIdTokenRequest, "grantType"> = {
      ...(clientPost && clientPost),
    };

    const body = sortKeys(merge(tokenRequest, input));

    const { data } = await conduit.post<OpenIdTokenResponse>(openid.tokenEndpoint, {
      body,
      middleware,
    });

    return data;
  };

  return { ...claims, login, logout, token };
};

// --- Socket claims client factory ---

export const createSocketClaimsClient = (
  ctx: PylonContext,
  config: PylonAuthConfig,
): PylonAuthClaimsClient => {
  const openid = getOpenIdConfiguration(ctx, config);

  const conduit = new Conduit({
    alias: "auth",
    environment: ctx.state.app.environment,
    logger: ctx.logger,
    middleware: [
      conduitCorrelationMiddleware(ctx.state.metadata.correlationId),
      conduitChangeRequestBodyMiddleware(),
      conduitChangeRequestQueryMiddleware(),
      conduitChangeResponseDataMiddleware(),
    ],
  });

  return createClaimsClient({
    ctx,
    config,
    conduit,
    openid,
    resolveAccessToken: () => ctx.state.authorization?.value ?? null,
  });
};
