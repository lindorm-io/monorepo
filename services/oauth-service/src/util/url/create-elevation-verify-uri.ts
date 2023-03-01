import { ElevationSession } from "../../entity";
import { createURL } from "@lindorm-io/url";
import { configuration } from "../../server/configuration";
import { Environment } from "@lindorm-io/common-types";

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
