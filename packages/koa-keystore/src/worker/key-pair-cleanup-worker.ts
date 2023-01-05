import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairRepository } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";
import { MongoConnection } from "@lindorm-io/mongo";
import { RetryOptions, stringToSeconds } from "@lindorm-io/core";

type Options = {
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: string;
};

export const keyPairCleanupWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, retry, workerInterval = "1 days" } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairMongoCacheWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const repository = new KeyPairRepository({
          connection: mongoConnection,
          logger,
        });

        await repository.deleteMany({ expires: { $lt: new Date() } });
      },
      retry,
      time,
    },
    logger,
  );
};
