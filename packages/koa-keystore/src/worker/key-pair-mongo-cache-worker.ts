import { ILogger } from "@lindorm-io/winston";
import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { KeyPairRepository } from "../infrastructure";
import { LindormError } from "@lindorm-io/errors";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { addSeconds } from "date-fns";
import { getExpiryDate, stringToSeconds } from "@lindorm-io/core";

interface Options {
  mongoConnection: MongoConnection;
  redisConnection: RedisConnection;
  retry?: number;
  winston: ILogger;
  workerInterval?: string;
}

export const keyPairMongoCacheWorker = (options: Options): IntervalWorker => {
  const {
    mongoConnection,
    redisConnection,
    retry = 10,
    winston,
    workerInterval = "1 hours",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairMongoCacheWorker"]);

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      const repository = new KeyPairRepository({
        connection: mongoConnection,
        logger,
      });

      const array = await repository.findMany({});

      if (!array.length) {
        throw new LindormError("No keys could be found in repository");
      }

      const cache = new KeyPairCache({
        connection: redisConnection,
        logger,
      });

      for (const entity of array) {
        if (!entity.expires) {
          entity.expires = addSeconds(getExpiryDate(workerInterval), 15);
        }
        await cache.create(entity);
      }
    },
    logger,
    retry,
    time,
  });
};
