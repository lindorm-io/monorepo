import { keyPairMongoMemoryWorker as _keyPairMongoMemoryWorker } from "@lindorm-io/koa-keystore";
import { memoryDatabase, mongoConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairMongoMemoryWorker = _keyPairMongoMemoryWorker({
  logger,
  memoryDatabase,
  mongoConnection,
});
