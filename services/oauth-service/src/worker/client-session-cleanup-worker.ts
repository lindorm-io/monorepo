import { IntervalWorker } from "@lindorm-io/koa";
import { ClientSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { stringToMilliseconds } from "@lindorm-io/expiry";
import { logger as winston } from "../server/logger";

const logger = winston.createChildLogger("sessionCleanupWorker");
const time = stringToMilliseconds("60 minutes");

export const clientSessionCleanupWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new ClientSessionRepository({
        connection: mongoConnection,
        logger,
      });

      await repository.deleteMany({ expires: { $lt: new Date() } });
    },
    time: time,
  },
  logger,
);
