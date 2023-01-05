import { Logger } from "@lindorm-io/core-logger";
import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { RedisConnection } from "@lindorm-io/redis";
import { addSeconds } from "date-fns";
import { getExpiryDate, RetryOptions, stringToSeconds } from "@lindorm-io/core";
import { getKeysFromJwks } from "../util";

type Options = {
  host: string;
  name?: string;
  path?: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  logger: Logger;
  workerInterval?: string;
};

export const keyPairJwksCacheWorker = (options: Options): IntervalWorker => {
  const { host, name, path, port, redisConnection, retry, workerInterval = "5 minutes" } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairJwksCacheWorker"]);

  logger.debug("creating jwks cache worker", {
    host,
    name,
    path,
    port,
    workerInterval,
  });

  return new IntervalWorker(
    {
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
      retry,
      time,
    },
    logger,
  );
};
