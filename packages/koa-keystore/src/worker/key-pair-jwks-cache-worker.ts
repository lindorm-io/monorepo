import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { Keystore } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";
import { WebKeyHandler } from "../class";
import { stringToSeconds } from "@lindorm-io/core";

interface Options {
  clientName: string;
  host: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: number;
  winston: ILogger;
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

  logger.debug("creating jwks cache worker", {
    clientName,
    host,
    port,
    workerInterval,
  });

  const handler = new WebKeyHandler({
    host,
    logger,
    name: clientName,
    port,
  });

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      const cache = new KeyPairCache({ connection: redisConnection, expiresInSeconds, logger });

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
