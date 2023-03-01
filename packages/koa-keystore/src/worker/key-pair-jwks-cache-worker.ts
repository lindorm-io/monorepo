import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { expiryDate, stringToSeconds } from "@lindorm-io/expiry";
import { getKeysFromJwks } from "../util";

type Options = {
  clientName?: string;
  host: string;
  logger: Logger;
  path?: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: string;
};

export const keyPairJwksCacheWorker = (options: Options): IntervalWorker => {
  const {
    clientName,
    host,
    path,
    port,
    redisConnection,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairJwksCacheWorker"]);

  logger.debug("creating jwks cache worker", {
    clientName,
    host,
    path,
    port,
    workerInterval,
  });

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const cache = new KeyPairCache({ connection: redisConnection, logger });

        const keys = await getKeysFromJwks({
          clientName,
          host,
          logger,
          path,
          port,
        });

        for (const entity of keys) {
          if (!entity.expires) {
            entity.expires = addSeconds(expiryDate(workerInterval), 15);
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
