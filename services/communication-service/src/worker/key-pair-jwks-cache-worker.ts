import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairDeviceJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.device_service.host,
  port: configuration.services.device_service.port,
  name: "device",
  redisConnection,
  retry: 30,
  winston,
});

export const keyPairOauthJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  name: "oauth",
  redisConnection,
  retry: 30,
  winston,
});
