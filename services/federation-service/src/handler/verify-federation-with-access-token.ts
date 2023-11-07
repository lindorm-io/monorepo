import { axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { OpenIdClaims } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { createURL } from "@lindorm-io/url";
import { find } from "lodash";
import { FederationSession } from "../entity";
import { configuration } from "../server/configuration";
import { ServerKoaContext } from "../types";

export const verifyFederationWithAccessToken = async (
  ctx: ServerKoaContext,
  federationSession: FederationSession,
  accessToken: string,
): Promise<OpenIdClaims> => {
  const {
    axios: { axiosClient },
    logger,
  } = ctx;

  const config = find(configuration.federation_providers, { key: federationSession.provider });

  if (!config) {
    throw new ServerError("Invalid identity provider");
  }

  const { base_url: host, userinfo_endpoint: userinfoEndpoint } = config;

  logger.debug("Resolving OIDC with access token");

  const { data } = await axiosClient.get<OpenIdClaims>(
    createURL(userinfoEndpoint, { host }).toString(),
    {
      middleware: [axiosBearerAuthMiddleware(accessToken)],
    },
  );

  logger.debug("Claims", data);

  return data;
};
