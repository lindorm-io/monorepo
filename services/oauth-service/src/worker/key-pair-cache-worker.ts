import { keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../logger";

export const keyPairCacheWorker = keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
