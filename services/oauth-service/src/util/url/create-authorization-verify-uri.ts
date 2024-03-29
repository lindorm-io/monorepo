import { TransformMode } from "@lindorm-io/case";
import { Environment } from "@lindorm-io/common-enums";
import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";
import { configuration } from "../../server/configuration";

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
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
