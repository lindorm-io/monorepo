import { GrantType, OpenIDClaims } from "../common";
import { OidcSession } from "../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../types";
import { configuration } from "../server/configuration";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import {
  axiosBasicAuthMiddleware,
  axiosBearerAuthMiddleware,
  OAuthTokenResponseData,
} from "@lindorm-io/axios";

export const verifyOidcWithCode = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  code: string,
): Promise<OpenIDClaims> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const config = find(configuration.oidc_providers, { key: oidcSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const {
    base_url: host,
    client_id: username,
    client_secret: password,
    userinfo_endpoint: userinfoEndpoint,
    token_endpoint: tokenEndpoint,
    scope,
  } = config;

  logger.debug("Resolving OIDC with code");

  const {
    data: { accessToken },
  } = await axiosClient.post<OAuthTokenResponseData>(
    createURL(tokenEndpoint, { host }).toString(),
    {
      body: {
        code,
        codeVerifier: oidcSession.codeVerifier,
        grantType: GrantType.AUTHORIZATION_CODE,
        redirectUri: createURL("/callback", { host: configuration.server.host }).toString(),
        scope,
      },
      middleware: [axiosBasicAuthMiddleware({ username, password })],
    },
  );

  logger.debug("Resolving user info");

  const { data } = await axiosClient.get<OpenIDClaims>(
    createURL(userinfoEndpoint, { host }).toString(),
    {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
    },
  );

  logger.debug("Claims", data);

  return data;
};
