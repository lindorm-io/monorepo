import { LogoutSession } from "../entity";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../configuration";

export const createLogoutVerifyRedirectUri = (logoutSession: LogoutSession): string => {
  return createURL("/oauth2/sessions/logout/verify", {
    baseUrl: configuration.server.host,
    query: {
      sessionId: logoutSession.id,
      redirectUri: logoutSession.redirectUri,
    },
  }).toString();
};
