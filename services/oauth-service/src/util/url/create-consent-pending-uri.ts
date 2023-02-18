import { AuthorizationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";

export const createConsentPendingUri = (authorizationSession: AuthorizationSession): string =>
  createURL(configuration.redirect.consent, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: authorizationSession.id,
      display: authorizationSession.displayMode,
      locales: authorizationSession.uiLocales,
    },
  }).toString();
