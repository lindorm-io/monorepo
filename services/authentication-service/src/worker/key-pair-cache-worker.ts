import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker, keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairDeviceJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.device_service.host,
  port: configuration.services.device_service.port,
  clientName: "Device",
  redisConnection,
  retry: 30,
  winston,
});

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  clientName: "oauthClient",
  redisConnection,
  retry: 30,
  winston,
});

export const keyPairCacheWorker = keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
