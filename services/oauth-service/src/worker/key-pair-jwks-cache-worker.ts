import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairAuthenticationJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.authentication_service.host,
  port: configuration.services.authentication_service.port,
  name: "authentication",
  redisConnection,
  logger,
});
