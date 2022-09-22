import { LogoutSession } from "../entity";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../server/configuration";
import { Environment } from "@lindorm-io/koa";

export const createLogoutVerifyUri = (logoutSession: LogoutSession): string => {
  return createURL("/oauth2/sessions/logout/verify", {
    host: configuration.server.host,
    port: configuration.server.environment === Environment.DEVELOPMENT && configuration.server.port,
    query: {
      sessionId: logoutSession.id,
      redirectUri: logoutSession.redirectUri,
    },
  }).toString();
};
