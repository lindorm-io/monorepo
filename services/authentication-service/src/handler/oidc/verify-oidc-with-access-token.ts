import { Account, LoginSession, OidcSession } from "../../entity";
import { ServerKoaContext } from "../../types";
import { OpenIDClaims } from "../../common";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";
import { getAuthenticatedAccount } from "./get-authenticated-account";

export const verifyOidcWithAccessToken = async (
  ctx: ServerKoaContext,
  loginSession: LoginSession,
  oidcSession: OidcSession,
  accessToken: string,
): Promise<Account> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const { base_url: host, userinfo_endpoint: userinfoEndpoint } =
    find(configuration.oidc_providers, { key: oidcSession.identityProvider }) || {};

  logger.debug("Resolving oidc with access token");

  const {
    data: { sub: subject, ...claims },
  } = await axiosClient.get<OpenIDClaims>(createURL(userinfoEndpoint, { host }).toString(), {
    middleware: [axiosBearerAuthMiddleware(accessToken)],
  });

  return await getAuthenticatedAccount(ctx, loginSession, oidcSession, {
    subject,
    claims,
  });
};
