import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "../server/configuration";
import { winston } from "../server/logger";
import { mongoConnection, redisConnection } from "../instance";
import { keyPairJwksCacheWorker, keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksCacheWorker({
      host: provider.base_url,
      clientName: provider.key,
      redisConnection,
      winston,
    }),
  );
}

export const keyPairDeviceJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.device_service.host,
  port: configuration.services.device_service.port,
  clientName: "Device",
  redisConnection,
  winston,
});

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  clientName: "OAuth",
  redisConnection,
  winston,
});

export const keyPairCacheWorker = keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
