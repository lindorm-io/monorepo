import { IntervalWorker } from "@lindorm-io/koa";
import { BrowserSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { stringToMilliseconds } from "@lindorm-io/core";
import { logger as winston } from "../server/logger";

const logger = winston.createChildLogger(["sessionCleanupWorker"]);
const time = stringToMilliseconds("60 minutes");

export const browserSessionCleanupWorker = new IntervalWorker({
  callback: async (): Promise<void> => {
    const repository = new BrowserSessionRepository({
      connection: mongoConnection,
      logger,
    });

    await repository.deleteMany({ expires: { $lt: new Date() } });
  },
  logger,
  time: time,
});
