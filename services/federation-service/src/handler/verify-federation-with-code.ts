import {
  OAuthTokenResponseData,
  axiosBasicAuthMiddleware,
  axiosBearerAuthMiddleware,
} from "@lindorm-io/axios";
import { OpenIdClaims, OpenIdGrantType } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import { FederationSession } from "../entity";
import { configuration } from "../server/configuration";
import { ServerKoaContext } from "../types";

export const verifyFederationWithCode = async (
  ctx: ServerKoaContext,
  federationSession: FederationSession,
  code: string,
): Promise<OpenIdClaims> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const config = find(configuration.federation_providers, { key: federationSession.provider });

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
        codeVerifier: federationSession.codeVerifier,
        grantType: OpenIdGrantType.AUTHORIZATION_CODE,
        redirectUri: createURL("/callback", { host: configuration.server.host }).toString(),
        scope,
      },
      middleware: [axiosBasicAuthMiddleware({ username, password })],
    },
  );

  logger.debug("Resolving user info");

  const { data } = await axiosClient.get<OpenIdClaims>(
    createURL(userinfoEndpoint, { host }).toString(),
    {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
    },
  );

  logger.debug("Claims", data);

  return data;
};
