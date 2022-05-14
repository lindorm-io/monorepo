import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairRepository } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { stringToSeconds } from "@lindorm-io/core";

interface Options {
  mongoConnection: MongoConnection;
  retry?: number;
  winston: Logger;
  workerInterval?: string;
}

export const keyPairCleanupWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, retry = 3, winston, workerInterval = "1 days" } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairMongoCacheWorker"]);

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      await mongoConnection.waitForConnection();

      const repository = new KeyPairRepository({
        db: mongoConnection.database(),
        logger,
      });

      await repository.destroyMany({ expires: { $lt: new Date() } });
    },
    logger,
    retry,
    time,
  });
};
