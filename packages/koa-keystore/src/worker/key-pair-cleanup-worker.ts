import { Logger } from "@lindorm-io/core-logger";
import { StringTimeValue, stringSeconds } from "@lindorm-io/expiry";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RetryOptions } from "@lindorm-io/retry";
import { KeyPairMongoRepository } from "../infrastructure";

type Options = {
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: StringTimeValue;
};

export const keyPairCleanupWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, retry, workerInterval = "1 days" } = options;

  const workerIntervalInSeconds = stringSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairCleanupWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new KeyPairMongoRepository(mongoConnection, logger);

        await repository.deleteMany({ expires: { $lt: new Date() } });
      },
      retry,
      time,
    },
    logger,
  );
};
