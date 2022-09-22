import { AuthorizationSession } from "../entity";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../server/configuration";
import { Environment } from "@lindorm-io/koa";

export const createAuthorizationVerifyUri = (
  authorizationSession: AuthorizationSession,
): string => {
  return createURL("/oauth2/sessions/authorize/verify", {
    host: configuration.server.host,
    port: configuration.server.environment === Environment.DEVELOPMENT && configuration.server.port,
    query: {
      sessionId: authorizationSession.id,
      redirectUri: authorizationSession.redirectUri,
    },
  }).toString();
};
