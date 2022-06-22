import { ILogger } from "@lindorm-io/winston";
import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { RedisConnection } from "@lindorm-io/redis";
import { addSeconds } from "date-fns";
import { getExpiryDate, stringToSeconds } from "@lindorm-io/core";
import { getKeysFromJwks } from "../util";

interface Options {
  host: string;
  name?: string;
  path?: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: number;
  winston: ILogger;
  workerInterval?: string;
}

export const keyPairJwksCacheWorker = (options: Options): IntervalWorker => {
  const {
    host,
    name,
    path,
    port,
    redisConnection,
    retry = 10,
    winston,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairJwksCacheWorker"]);

  logger.debug("creating jwks cache worker", {
    host,
    name,
    path,
    port,
    workerInterval,
  });

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      const cache = new KeyPairCache({ connection: redisConnection, logger });

      const keys = await getKeysFromJwks({
        logger,
        host,
        name,
        path,
        port,
      });

      for (const entity of keys) {
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
