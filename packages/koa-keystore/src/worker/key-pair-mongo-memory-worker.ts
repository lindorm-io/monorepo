import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { StringTimeValue, expiryDate, stringSeconds } from "@lindorm-io/expiry";
import { IMemoryDatabase } from "@lindorm-io/in-memory-cache";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { KeyPairMemoryCache, KeyPairMongoRepository } from "../infrastructure";

type Options = {
  logger: Logger;
  memoryDatabase: IMemoryDatabase;
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: StringTimeValue;
};

export const keyPairMongoMemoryWorker = (options: Options): IntervalWorker => {
  const { memoryDatabase, mongoConnection, retry, workerInterval = "1 hours" } = options;

  const workerIntervalInSeconds = stringSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairMongoMemoryWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const mongoRepository = new KeyPairMongoRepository(mongoConnection, logger);

        const array = await mongoRepository.findMany({});

        if (!array.length) {
          throw new LindormError("No keys could be found in repository");
        }

        const memoryCache = new KeyPairMemoryCache(memoryDatabase, logger);

        for (const entity of array) {
          if (!entity.expires) {
            entity.expires = addSeconds(expiryDate(workerInterval), 15);
          }
          await memoryCache.upsert(entity);
        }
      },
      retry,
      time,
    },
    logger,
  );
};
