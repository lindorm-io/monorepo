import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { Keystore } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";
import { WebKeyHandler } from "../class";
import { stringToSeconds } from "@lindorm-io/core";

interface Options {
  clientName: string;
  host: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: number;
  winston: Logger;
  workerInterval?: string;
}

export const keyPairJwksCacheWorker = (options: Options): IntervalWorker => {
  const {
    clientName,
    host,
    port,
    redisConnection,
    retry = 10,
    winston,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const expiresInSeconds = workerIntervalInSeconds + 120;
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairJwksCacheWorker"]);

  logger.verbose("creating jwks cache worker", {
    host,
    port,
    clientName,
    workerInterval,
  });

  const handler = new WebKeyHandler({ clientName, host, port, logger });

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
    retry,
    time,
  });
};
