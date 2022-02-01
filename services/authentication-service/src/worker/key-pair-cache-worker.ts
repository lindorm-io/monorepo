import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "../configuration";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../logger";
import { keyPairJwksCacheWorker, keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksCacheWorker({
      baseUrl: provider.base_url,
      clientName: provider.key,
      redisConnection,
      winston,
    }),
  );
}

export const keyPairDeviceJwksWorker = keyPairJwksCacheWorker({
  baseUrl: configuration.services.device_service,
  clientName: "Device",
  redisConnection,
  winston,
});

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
