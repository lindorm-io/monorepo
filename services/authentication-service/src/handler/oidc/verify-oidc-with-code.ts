import { Account, LoginSession, OidcSession } from "../../entity";
import { Context } from "../../types";
import { GrantType, OpenIDClaims } from "../../common";
import { axiosBearerAuthMiddleware, OAuthTokenResponseData } from "@lindorm-io/axios";
import { configuration } from "../../configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";
import { getAuthenticatedAccount } from "./get-authenticated-account";

export const verifyOidcWithCode = async (
  ctx: Context,
  loginSession: LoginSession,
  oidcSession: OidcSession,
  code: string,
): Promise<Account> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const {
    base_url: baseUrl,
    client_id: clientId,
    client_secret: clientSecret,
    userinfo_endpoint: userinfoEndpoint,
    token_endpoint: tokenEndpoint,
  } = find(configuration.oidc_providers, { key: oidcSession.identityProvider }) || {};

  logger.debug("Resolving oidc with code");

  const {
    data: { accessToken },
  } = await axiosClient.post<OAuthTokenResponseData>(
    createURL(tokenEndpoint, { baseUrl }).toString(),
    {
      data: {
        clientId,
        clientSecret,
        code,
        codeVerifier: oidcSession.codeVerifier,
        grantType: GrantType.AUTHORIZATION_CODE,
        redirectUri: oidcSession.redirectUri,
        scope: oidcSession.scope,
      },
    },
  );

  logger.debug("Resolving user info");

  const {
    data: { sub: subject, ...claims },
  } = await axiosClient.get<OpenIDClaims>(createURL(userinfoEndpoint, { baseUrl }).toString(), {
    middleware: [axiosBearerAuthMiddleware(accessToken)],
  });

  return await getAuthenticatedAccount(ctx, loginSession, oidcSession, {
    subject,
    claims,
  });
};
