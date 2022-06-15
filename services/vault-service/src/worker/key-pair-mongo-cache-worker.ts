import { keyPairMongoCacheWorker as _keyPairMongoCacheWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "../server/logger";

export const keyPairMongoCacheWorker = _keyPairMongoCacheWorker({
  mongoConnection,
  redisConnection,
  winston,
});
