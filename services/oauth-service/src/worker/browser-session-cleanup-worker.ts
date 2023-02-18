import { IntervalWorker } from "@lindorm-io/koa";
import { BrowserSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { stringToDurationObject, stringToMilliseconds } from "@lindorm-io/expiry";
import { logger as winston } from "../server/logger";
import { sub } from "date-fns";

const logger = winston.createChildLogger("sessionCleanupWorker");
const time = stringToMilliseconds("60 minutes");

export const browserSessionCleanupWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new BrowserSessionRepository({
        connection: mongoConnection,
        logger,
      });

      await repository.deleteMany({
        latestAuthentication: { $lt: sub(new Date(), stringToDurationObject("1 years")) },
      });
    },
    time: time,
  },
  logger,
);
