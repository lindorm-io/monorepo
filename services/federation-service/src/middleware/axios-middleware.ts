import { axiosClientCredentialsMiddleware } from "@lindorm-io/axios";
import { configuration } from "../server/configuration";
import { logger } from "../server/logger";

export const clientCredentialsMiddleware = axiosClientCredentialsMiddleware({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  clientId: configuration.oauth.client_id,
  clientSecret: configuration.oauth.client_secret,
  logger,
});
