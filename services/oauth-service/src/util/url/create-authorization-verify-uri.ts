import { AuthorizationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";
import { Environment } from "@lindorm-io/common-types";

export const createAuthorizationVerifyUri = (authorizationSession: AuthorizationSession): string =>
  createURL("/oauth2/sessions/authorize/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environment.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: authorizationSession.id,
      redirectUri: authorizationSession.redirectUri,
    },
  }).toString();
