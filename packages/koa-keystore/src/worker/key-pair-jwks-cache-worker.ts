import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { Keystore } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";
import { WebKeyHandler } from "../class";
import { stringToSeconds } from "@lindorm-io/core";

interface Options {
  baseUrl: string;
  clientName: string;
  redisConnection: RedisConnection;
  winston: Logger;
  workerInterval?: string;
}

export const keyPairJwksCacheWorker = (options: Options): IntervalWorker => {
  const { baseUrl, clientName, redisConnection, winston, workerInterval = "5 minutes" } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const expiresInSeconds = workerIntervalInSeconds + 120;
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairJwksCacheWorker"]);

  logger.verbose("creating jwks cache worker", {
    baseUrl,
    clientName,
    workerInterval,
  });

  const handler = new WebKeyHandler({ baseUrl, logger, clientName });

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      await redisConnection.waitForConnection();

      const cache = new KeyPairCache({
        client: redisConnection.client(),
        logger,
        expiresInSeconds,
      });

      const array = await handler.getKeys();

      for (const entity of array) {
        const expires = Keystore.getTTL(entity);
        await cache.create(entity, expires?.seconds);
      }
    },
    logger,
    retry: 3,
    time,
  });
};
