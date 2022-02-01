import { AuthorizationSession } from "../entity";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../configuration";

export const createAuthorizationVerifyRedirectUri = (
  authorizationSession: AuthorizationSession,
): string => {
  return createURL("/oauth/sessions/authorize/verify", {
    baseUrl: configuration.server.host,
    query: {
      sessionId: authorizationSession.id,
      redirectUri: authorizationSession.redirectUri,
    },
  }).toString();
};
