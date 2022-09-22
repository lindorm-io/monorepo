import { AuthorizationSession } from "../entity";
import { createURL } from "@lindorm-io/core";
import { configuration } from "../server/configuration";

export const createLoginPendingUri = (authorizationSession: AuthorizationSession): string => {
  return createURL(configuration.redirect.login, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: { sessionId: authorizationSession.id },
  }).toString();
};
