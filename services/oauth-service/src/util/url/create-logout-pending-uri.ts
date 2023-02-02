import { LogoutSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";

export const createLogoutPendingUri = (logoutSession: LogoutSession): string => {
  return createURL(configuration.redirect.logout, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: { sessionId: logoutSession.id },
  }).toString();
};
