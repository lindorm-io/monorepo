import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const createSelectAccountPendingUri = (authorizationSession: AuthorizationSession): string =>
  createURL(configuration.redirect.select, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: authorizationSession.id,
      display: authorizationSession.displayMode,
      locales: authorizationSession.uiLocales,
    },
  }).toString();
