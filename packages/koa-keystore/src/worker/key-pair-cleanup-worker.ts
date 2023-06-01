import { Logger } from "@lindorm-io/core-logger";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { KeyPairMongoRepository } from "../infrastructure";

type Options = {
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: ReadableTime;
};

export const keyPairCleanupWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, retry, workerInterval = "1 days" } = options;

  const logger = options.logger.createChildLogger(["keyPairCleanupWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new KeyPairMongoRepository(mongoConnection, logger);

        await repository.deleteMany({ expires: { $lt: new Date() } });
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
