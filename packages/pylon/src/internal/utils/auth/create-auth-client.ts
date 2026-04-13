import {
  Aegis,
  AegisIntrospection,
  AegisIntrospectionActive,
  AegisUserinfo,
  isParsedJwt,
} from "@lindorm/aegis";
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
import { IConduit } from "@lindorm/conduit";
import { isNumberString } from "@lindorm/is";
import { PKCE } from "@lindorm/pkce";
import {
  OpenIdAuthorizeRequestQuery,
  OpenIdClaims,
  OpenIdConfiguration,
  OpenIdIntrospectResponse,
  OpenIdLogoutRequest,
  OpenIdTokenRequest,
  OpenIdTokenResponse,
} from "@lindorm/types";
import { createUrl } from "@lindorm/url";
import { merge, sortKeys } from "@lindorm/utils";
import { randomBytes } from "crypto";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed";
import {
  AuthorizeQuery,
  AuthorizeResult,
  LogoutQuery,
  LogoutResult,
  PylonAuthClient,
  PylonAuthClaimsClient,
  PylonAuthConfig,
  PylonContext,
  PylonHttpContext,
  TokenRequest,
} from "../../../types";
import { getOpenIdConfiguration } from "./get-open-id-configuration";

// --- Claims client (works on both HTTP and socket) ---

type ClaimsClientOptions = {
  ctx: PylonContext;
  config: PylonAuthConfig;
  conduit: IConduit;
  openid: OpenIdConfiguration;
  resolveAccessToken: () => string | null;
};

export const createClaimsClient = (
  options: ClaimsClientOptions,
): PylonAuthClaimsClient => {
  const { ctx, config, conduit, openid, resolveAccessToken } = options;

  // Per-token caches: the empty string sentinel "" is the no-arg /
  // context-resolved-token entry. Explicit tokens are keyed by their value.
  const userinfoCache = new Map<string, AegisUserinfo>();
  const introspectCache = new Map<string, AegisIntrospection>();

  const userinfo = async (token?: string): Promise<AegisUserinfo> => {
    const cacheKey = token ?? "";
    const cached = userinfoCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify (id_token-style JWT).
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (isParsedJwt(verified)) {
          const result = Aegis.parseUserinfo(verified.payload);
          userinfoCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to endpoint with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed id_token from context if available.
      const idToken = ctx.state.tokens?.idToken;
      if (idToken && isParsedJwt(idToken)) {
        const result = Aegis.parseUserinfo(idToken.payload);
        userinfoCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new UserinfoEndpointFailed("No access token available for userinfo request");
    }

    try {
      const { data } = await conduit.get<OpenIdClaims>(openid.userinfoEndpoint, {
        middleware: [conduitBearerAuthMiddleware(accessToken)],
      });

      const result = Aegis.parseUserinfo(data);
      userinfoCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw new UserinfoEndpointFailed(
        error instanceof Error ? error.message : "Userinfo endpoint request failed",
      );
    }
  };

  const introspect = async (token?: string): Promise<AegisIntrospection> => {
    const cacheKey = token ?? "";
    const cached = introspectCache.get(cacheKey);
    if (cached) return cached;

    // Fast path: explicit token — try local verify first.
    if (token) {
      try {
        const verified = await ctx.aegis.verify(token);
        if (isParsedJwt(verified)) {
          const { claims: _, profile: __, ...rest } = verified.payload;
          const result: AegisIntrospectionActive = { ...rest, active: true };
          introspectCache.set(cacheKey, result);
          return result;
        }
      } catch {
        // Verification failed — fall through to endpoint with the explicit token.
      }
    } else {
      // Fast path: no-arg — use the parsed access token from context if available.
      const accessTokenParsed = ctx.state.tokens?.accessToken;
      if (accessTokenParsed && isParsedJwt(accessTokenParsed)) {
        // ParsedJwtPayload has `claims` (custom claim bucket) and `profile`
        // (extracted AegisProfile) which AegisIntrospectionActive does not
        // model. `confirmation` IS part of PopClaims and passes through.
        const { claims: _, profile: __, ...rest } = accessTokenParsed.payload;
        const result: AegisIntrospectionActive = { ...rest, active: true };
        introspectCache.set(cacheKey, result);
        return result;
      }
    }

    const accessToken = token ?? resolveAccessToken();

    if (!accessToken) {
      throw new IntrospectionEndpointFailed(
        "No access token available for introspection request",
      );
    }

    try {
      const { data } = await conduit.post<OpenIdIntrospectResponse>(
        openid.introspectEndpoint,
        {
          body: { token: accessToken },
          middleware: [conduitBasicAuthMiddleware(config.clientId, config.clientSecret)],
        },
      );

      const result = Aegis.parseIntrospection(data);
      introspectCache.set(cacheKey, result);
      return result;
    } catch (error) {
      throw new IntrospectionEndpointFailed(
        error instanceof Error ? error.message : "Introspection endpoint request failed",
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
      throw new Error("Auth router is not configured");
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
      throw new Error("Auth router is not configured");
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

    const redirect = createUrl(openid.logoutEndpoint, {
      query: sortKeys(merge(logoutRequest, input)),
      changeQueryCase: "snake",
    });

    return { redirect, state };
  };

  const token = async (input: TokenRequest): Promise<OpenIdTokenResponse> => {
    const { clientId, clientSecret } = config;

    const clientPost = openid.tokenEndpointAuthMethodsSupported.includes(
      "client_secret_post",
    )
      ? {
          clientId,
          clientSecret,
        }
      : null;

    const middleware = openid.tokenEndpointAuthMethodsSupported.includes(
      "client_secret_basic",
    )
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
