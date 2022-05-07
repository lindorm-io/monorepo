import { configuration } from "../configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { winston } from "../logger";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  baseUrl: configuration.oauth.host,
  clientName: "OAuth",
  redisConnection,
  winston,
});
