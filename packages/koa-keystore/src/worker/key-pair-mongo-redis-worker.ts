import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairMongoRepository, KeyPairRedisRepository } from "../infrastructure";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/core-logger";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { expiryDate, stringToSeconds } from "@lindorm-io/expiry";

type Options = {
  mongoConnection: MongoConnection;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: string;
};

export const keyPairMongoRedisWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, redisConnection, retry, workerInterval = "1 hours" } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairMongoCacheWorker"]);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const mongoRepository = new KeyPairMongoRepository(mongoConnection, logger);

        const array = await mongoRepository.findMany({});

        if (!array.length) {
          throw new LindormError("No keys could be found in repository");
        }

        const redisRepository = new KeyPairRedisRepository(redisConnection, logger);

        for (const entity of array) {
          if (!entity.expires) {
            entity.expires = addSeconds(expiryDate(workerInterval), 15);
          }
          await redisRepository.upsert(entity);
        }
      },
      retry,
      time,
    },
    logger,
  );
};
