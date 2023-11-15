import { createURL } from "@lindorm-io/url";
import { ElevationSession } from "../../entity";
import { configuration } from "../../server/configuration";
import { TransformMode } from "@lindorm-io/case";

export const createElevationPendingUri = (elevationSession: ElevationSession): string =>
  createURL(configuration.services.authentication_service.routes.redirect.elevate, {
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    query: {
      session: elevationSession.id,
      display: elevationSession.displayMode,
      locales: elevationSession.uiLocales,
    },
    queryCaseTransform: TransformMode.SNAKE,
  }).toString();
