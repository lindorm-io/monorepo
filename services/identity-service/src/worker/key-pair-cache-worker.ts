import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  clientName: "oauthClient",
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  redisConnection,
  retry: 30,
  winston,
});
