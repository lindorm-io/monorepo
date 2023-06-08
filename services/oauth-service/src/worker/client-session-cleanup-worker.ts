import { IntervalWorker } from "@lindorm-io/koa";
import { ms } from "@lindorm-io/readable-time";
import { ClientSessionRepository } from "../infrastructure";
import { mongoConnection } from "../instance";
import { logger as winston } from "../server/logger";

const logger = winston.createChildLogger("sessionCleanupWorker");

export const clientSessionCleanupWorker = new IntervalWorker(
  {
    callback: async (): Promise<void> => {
      const repository = new ClientSessionRepository(mongoConnection, logger);
      await repository.deleteMany({ expires: { $lt: new Date() } });
    },
    time: ms("60 minutes"),
  },
  logger,
);
