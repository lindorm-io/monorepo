import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  clientName: "OAuth",
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  redisConnection,
  retry: 30,
  winston,
});

export const keyPairCacheWorker = keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
