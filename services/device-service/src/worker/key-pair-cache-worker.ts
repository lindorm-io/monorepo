import { configuration } from "../server/configuration";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../server/logger";
import { keyPairJwksCacheWorker, keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  clientName: "oauthClient",
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
