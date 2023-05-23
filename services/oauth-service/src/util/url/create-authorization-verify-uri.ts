import { Environment } from "@lindorm-io/common-types";
import { createURL } from "@lindorm-io/url";
import { AuthorizationRequest } from "../../entity";
import { configuration } from "../../server/configuration";

export const createAuthorizationVerifyUri = (authorizationRequest: AuthorizationRequest): string =>
  createURL("/oauth2/sessions/authorize/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environment.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: authorizationRequest.id,
      redirectUri: authorizationRequest.redirectUri,
    },
  }).toString();
