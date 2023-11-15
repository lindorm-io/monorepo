import { TransformMode } from "@lindorm-io/case";
import { createURL } from "@lindorm-io/url";
import { AuthorizationSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const createConsentPendingUri = (authorizationSession: AuthorizationSession): string =>
  createURL(configuration.services.authentication_service.routes.redirect.consent, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: authorizationSession.id,
      display: authorizationSession.displayMode,
      locales: authorizationSession.uiLocales,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
