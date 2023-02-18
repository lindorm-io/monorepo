import { AuthorizationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";
import { Environments } from "@lindorm-io/common-types";

export const createAuthorizationVerifyUri = (authorizationSession: AuthorizationSession): string =>
  createURL("/oauth2/sessions/authorize/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environments.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: authorizationSession.id,
      redirectUri: authorizationSession.redirectUri,
    },
  }).toString();
