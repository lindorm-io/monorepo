import { ChangeCase } from "@lindorm/case";
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
import { PkceMethod } from "@lindorm/enums";
import { isNumberString } from "@lindorm/is";
import { PKCE } from "@lindorm/pkce";
import {
  OpenIdAuthorizeRequestQuery,
  OpenIdClaims,
  OpenIdLogoutRequest,
  OpenIdResponseType,
  OpenIdTokenRequest,
  OpenIdTokenResponse,
} from "@lindorm/types";
import { createUrl } from "@lindorm/url";
import { merge, sortKeys } from "@lindorm/utils";
import { randomBytes } from "crypto";
import { PylonAuthConfig, PylonHttpContext } from "../../../types";
import { getOpenIdConfiguration } from "./get-open-id-configuration";

type AuthorizeQuery = Partial<
  Omit<
    OpenIdAuthorizeRequestQuery,
    | "clientId"
    | "codeChallenge"
    | "codeChallengeMethod"
    | "nonce"
    | "redirectUri"
    | "responseMode"
    | "responseType"
    | "state"
  >
>;

type AuthorizeResult = {
  codeChallengeMethod: PkceMethod;
  codeVerifier: string;
  nonce: string;
  redirect: URL;
  responseType: OpenIdResponseType;
  scope: string;
  state: string;
};

type LogoutQuery = Partial<
  Omit<OpenIdLogoutRequest, "clientId" | "postLogoutRedirectUri" | "state">
>;

type LogoutResult = {
  redirect: URL;
  state: string;
};

type TokenRequest = Omit<OpenIdTokenRequest, "clientId" | "clientSecret">;

export type AuthClient = {
  login(query?: AuthorizeQuery): AuthorizeResult;
  logout(query?: LogoutQuery): LogoutResult;
  token(body: TokenRequest): Promise<OpenIdTokenResponse>;
  userinfo(accessToken: string): Promise<OpenIdClaims>;
};

export const getAuthClient = (
  ctx: PylonHttpContext,
  config: PylonAuthConfig,
): AuthClient => {
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

  const login = (input: AuthorizeQuery = {}): AuthorizeResult => {
    const {
      method: codeChallengeMethod,
      challenge: codeChallenge,
      verifier: codeVerifier,
    } = PKCE.create(config.codeChallengeMethod);

    const { clientId } = config;
    const { acrValues, audience, prompt, responseType, scope } = config.defaults;
    const maxAge = isNumberString(input.maxAge)
      ? input.maxAge.toString()
      : config.defaults.maxAge
        ? sec(config.defaults.maxAge).toString()
        : undefined;

    const code = responseType.includes("code");
    const nonce = randomBytes(16).toString("base64url");
    const state = randomBytes(16).toString("base64url");

    const authorize: OpenIdAuthorizeRequestQuery = {
      clientId,
      nonce,
      redirectUri: new URL("/auth/login/callback", ctx.request.origin).toString(),
      responseType,
      scope: scope.join(" "),
      state,
      ...(acrValues && { acrValues }),
      ...(audience && { audience }),
      ...(code && { codeChallenge, codeChallengeMethod }),
      ...(maxAge && { maxAge }),
      ...(prompt && { prompt }),
    };

    const query = sortKeys(merge<OpenIdAuthorizeRequestQuery>(authorize, input));

    const redirect = createUrl(openid.authorizationEndpoint, {
      query,
      changeQueryCase: ChangeCase.Snake,
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
    const { clientId } = config;

    const state = randomBytes(16).toString("base64url");

    const logout: OpenIdLogoutRequest = {
      clientId,
      postLogoutRedirectUri: new URL(
        "/auth/logout/callback",
        ctx.request.origin,
      ).toString(),
      state,
    };

    const redirect = createUrl(openid.logoutEndpoint, {
      query: sortKeys(merge(logout, input)),
      changeQueryCase: ChangeCase.Snake,
    });

    return { redirect, state };
  };

  const token = async (input: TokenRequest): Promise<OpenIdTokenResponse> => {
    const { clientId, clientSecret } = config;
    const { audience } = config.defaults;

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

    const token: Omit<OpenIdTokenRequest, "grantType"> = {
      ...(audience && { audience }),
      ...(clientPost && clientPost),
    };

    const body = sortKeys(merge(token, input));

    const { data } = await conduit.post<OpenIdTokenResponse>(openid.tokenEndpoint, {
      body,
      middleware,
    });

    return data;
  };

  const userinfo = async (accessToken: string): Promise<OpenIdClaims> => {
    const { data } = await conduit.get<OpenIdClaims>(openid.userinfoEndpoint, {
      middleware: [conduitBearerAuthMiddleware(accessToken)],
    });

    return data;
  };

  return { login, logout, token, userinfo };
};
