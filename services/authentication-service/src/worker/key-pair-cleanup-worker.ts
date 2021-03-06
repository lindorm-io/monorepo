import { keyPairCleanupWorker as _keyPairCleanupWorker } from "@lindorm-io/koa-keystore";
import { mongoConnection } from "../instance";
import { logger } from "../server/logger";

export const keyPairCleanupWorker = _keyPairCleanupWorker({
  mongoConnection,
  logger,
});
