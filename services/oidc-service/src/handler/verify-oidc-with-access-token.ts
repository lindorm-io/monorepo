import { OidcSession } from "../entity";
import { OpenIDClaims } from "../common";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../types";
import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { configuration } from "../server/configuration";
import { createURL } from "@lindorm-io/core";
import { find } from "lodash";

export const verifyOidcWithAccessToken = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  accessToken: string,
): Promise<OpenIDClaims> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const config = find(configuration.oidc_providers, { key: oidcSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const { base_url: host, userinfo_endpoint: userinfoEndpoint } = config;

  logger.debug("Resolving OIDC with access token");

  const { data } = await axiosClient.get<OpenIDClaims>(
    createURL(userinfoEndpoint, { host }).toString(),
    {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
    },
  );

  logger.debug("Claims", data);

  return data;
};
