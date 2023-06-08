import { IntervalWorker } from "@lindorm-io/koa";
import { ms, readableDuration } from "@lindorm-io/readable-time";
import { sub } from "date-fns";
import { BrowserSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { logger as winston } from "../server/logger";

const logger = winston.createChildLogger("sessionCleanupWorker");

export const browserSessionCleanupWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new BrowserSessionRepository(mongoConnection, logger);
      await repository.deleteMany({
        latestAuthentication: { $lt: sub(new Date(), readableDuration("1 years")) },
      });
    },
    time: ms("60 minutes"),
  },
  logger,
);
