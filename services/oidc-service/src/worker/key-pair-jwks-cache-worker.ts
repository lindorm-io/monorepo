import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairOauthJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  name: "oauth",
  redisConnection,
  retry: { maximumAttempts: 30 },
  logger,
});
