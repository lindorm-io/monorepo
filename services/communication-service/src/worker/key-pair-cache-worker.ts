import { configuration, logger } from "../server";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  clientName: "OAuth",
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  redisConnection,
  winston: logger,
});
