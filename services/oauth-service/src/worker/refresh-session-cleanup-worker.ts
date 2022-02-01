import { IntervalWorker } from "@lindorm-io/koa";
import { RefreshSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { stringToMilliseconds } from "@lindorm-io/core";
import { winston } from "../logger";

const logger = winston.createChildLogger(["sessionCleanupWorker"]);
const time = stringToMilliseconds("60 minutes");

export const refreshSessionCleanupWorker = new IntervalWorker({
  callback: async (): Promise<void> => {
    await mongoConnection.waitForConnection();

    const repository = new RefreshSessionRepository({
      db: mongoConnection.database(),
      logger,
    });

    await repository.destroyMany({ expires: { $lt: new Date() } });
  },
  logger,
  time: time,
});
