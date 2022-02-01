import { configuration } from "../configuration";
import { redisConnection } from "../instance";
import { winston } from "../logger";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  baseUrl: configuration.oauth.host,
  clientName: "OAuth",
  redisConnection,
  winston,
});
