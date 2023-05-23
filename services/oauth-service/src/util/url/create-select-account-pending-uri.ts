import { createURL } from "@lindorm-io/url";
import { AuthorizationRequest } from "../../entity";
import { configuration } from "../../server/configuration";

export const createSelectAccountPendingUri = (authorizationRequest: AuthorizationRequest): string =>
  createURL(configuration.redirect.select, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: authorizationRequest.id,
      display: authorizationRequest.displayMode,
      locales: authorizationRequest.uiLocales,
    },
  }).toString();
