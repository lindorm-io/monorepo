import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { expiryDate } from "@lindorm-io/expiry";
import { IntervalWorker } from "@lindorm-io/koa";
import { MongoConnection } from "@lindorm-io/mongo";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { KeyPairMongoRepository, KeyPairRedisRepository } from "../infrastructure";

type Options = {
  mongoConnection: MongoConnection;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: ReadableTime;
};

export const keyPairMongoRedisWorker = (options: Options): IntervalWorker => {
  const { mongoConnection, redisConnection, retry, workerInterval = "1 hours" } = options;

  const logger = options.logger.createChildLogger(["keyPairMongoRedisWorker"]);

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
      time: ms(workerInterval),
    },
    logger,
  );
};
