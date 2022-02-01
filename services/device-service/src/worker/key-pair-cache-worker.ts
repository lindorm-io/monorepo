import { configuration } from "../configuration";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../logger";
import { keyPairJwksCacheWorker, keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  baseUrl: configuration.oauth.host,
  clientName: "OAuth",
  redisConnection,
  winston,
});

export const keyPairCacheWorker = keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
