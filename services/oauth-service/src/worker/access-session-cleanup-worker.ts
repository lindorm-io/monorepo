import { IntervalWorker } from "@lindorm-io/koa";
import { AccessSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { stringToDurationObject, stringToMilliseconds } from "@lindorm-io/expiry";
import { logger as winston } from "../server/logger";
import { sub } from "date-fns";

const logger = winston.createChildLogger("sessionCleanupWorker");
const time = stringToMilliseconds("60 minutes");

export const accessSessionCleanupWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new AccessSessionRepository({
        connection: mongoConnection,
        logger,
      });

      await repository.deleteMany({
        latestAuthentication: { $lt: sub(new Date(), stringToDurationObject("2 years")) },
      });
    },
    time: time,
  },
  logger,
);
