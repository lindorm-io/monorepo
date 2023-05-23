import { Environment } from "@lindorm-io/common-types";
import { createURL } from "@lindorm-io/url";
import { ElevationRequest } from "../../entity";
import { configuration } from "../../server/configuration";

export const createElevationVerifyUri = (elevationRequest: ElevationRequest): string =>
  createURL("/oauth2/sessions/elevate/verify", {
    host: configuration.server.host,
    port:
      configuration.server.environment === Environment.DEVELOPMENT
        ? configuration.server.port
        : undefined,
    query: {
      session: elevationRequest.id,
      redirectUri: elevationRequest.redirectUri,
    },
  }).toString();
