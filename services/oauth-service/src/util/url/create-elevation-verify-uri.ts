import { Environment } from "@lindorm-io/common-enums";
import { createURL } from "@lindorm-io/url";
import { ElevationSession } from "../../entity";
import { configuration } from "../../server/configuration";

export const createElevationVerifyUri = (elevationSession: ElevationSession): string =>
  createURL("/oauth2/sessions/elevate/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environment.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: elevationSession.id,
      redirectUri: elevationSession.redirectUri,
    },
  }).toString();
