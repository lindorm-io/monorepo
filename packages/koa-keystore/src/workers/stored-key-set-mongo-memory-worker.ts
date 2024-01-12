import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { IMemoryDatabase } from "@lindorm-io/in-memory-cache";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { StoredKeySetMemoryCache, StoredKeySetMongoRepository } from "../infrastructure";

type Options = {
  logger: Logger;
  memoryDatabase: IMemoryDatabase;
  mongoConnection: MongoConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: ReadableTime;
};

export const storedKeySetMongoMemoryWorker = (options: Options): IntervalWorker => {
  const { memoryDatabase, mongoConnection, retry, workerInterval = "1 hours" } = options;

  const logger = options.logger.createChildLogger(["storedKeySetMongoMemoryWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const mongoRepository = new StoredKeySetMongoRepository(mongoConnection, logger);

        const array = await mongoRepository.findMany({});

        if (!array.length) {
          throw new LindormError("No keys could be found in repository");
        }

        const memoryCache = new StoredKeySetMemoryCache(memoryDatabase, logger);

        for (const entity of array) {
          if (!entity.webKeySet.expiresAt) {
            entity.webKeySet.expiresAt = addSeconds(expiryDate(workerInterval), 15);
          }
          await memoryCache.upsert(entity);
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
