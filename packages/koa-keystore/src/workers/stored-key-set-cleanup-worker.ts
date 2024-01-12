import { Logger } from "@lindorm-io/core-logger";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { StoredKeySetMongoRepository } from "../infrastructure";

type Options = {
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: ReadableTime;
};

export const storedKeySetCleanupWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, retry, workerInterval = "1 days" } = options;

  const logger = options.logger.createChildLogger(["storedKeySetCleanupWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new StoredKeySetMongoRepository(mongoConnection, logger);

        await repository.deleteMany({ expiresAt: { $lt: new Date() } });
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
