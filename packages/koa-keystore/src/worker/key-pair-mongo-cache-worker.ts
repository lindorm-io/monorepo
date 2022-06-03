import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { KeyPairRepository } from "../infrastructure";
import { Keystore } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { RedisConnection } from "@lindorm-io/redis";
import { stringToSeconds } from "@lindorm-io/core";
import { LindormError } from "@lindorm-io/errors";

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
  const expiresInSeconds = workerIntervalInSeconds + 120;
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
        expiresInSeconds,
      });

      for (const entity of array) {
        const expires = Keystore.getTTL(entity);
        await cache.create(entity, expires?.seconds);
      }
    },
    logger,
    retry,
    time,
  });
};
