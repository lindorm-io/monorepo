import { createURL } from "@lindorm-io/url";
import { ElevationRequest } from "../../entity";
import { configuration } from "../../server/configuration";

export const createElevationPendingUri = (elevationRequest: ElevationRequest): string =>
  createURL(configuration.redirect.elevate, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: elevationRequest.id,
      display: elevationRequest.displayMode,
      locales: elevationRequest.uiLocales,
    },
  }).toString();
