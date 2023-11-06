import { createURL } from "@lindorm-io/url";
import { LogoutSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const createLogoutPendingUri = (logoutSession: LogoutSession): string =>
  createURL(configuration.services.authentication_service.routes.redirect.logout, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: logoutSession.id,
      display: logoutSession.displayMode,
      locales: logoutSession.uiLocales,
    },
  }).toString();
