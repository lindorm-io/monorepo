import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairRedisRepository } from "../infrastructure";
import { Logger } from "@lindorm-io/core-logger";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { expiryDate, stringToSeconds } from "@lindorm-io/expiry";
import { getKeysFromJwks } from "../util";
import {
  axiosClientCredentialsMiddleware,
  AxiosClientCredentialsMiddlewareOptions,
} from "@lindorm-io/axios";

type Options = {
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  clientName?: string;
  host: string;
  logger: Logger;
  path?: string;
  port?: number;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: string;
};

export const keyPairJwksRedisWorker = (options: Options): IntervalWorker => {
  const {
    clientCredentials,
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
  const logger = options.logger.createChildLogger(["keyPairJwksRedisWorker"]);

  logger.debug("creating jwks cache worker", {
    clientName,
    host,
    path,
    port,
    workerInterval,
  });

  const clientCredentialsMiddleware = clientCredentials
    ? axiosClientCredentialsMiddleware(clientCredentials)
    : undefined;

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const redisRepository = new KeyPairRedisRepository(redisConnection, logger);

        const keys = await getKeysFromJwks({
          clientName,
          host,
          logger,
          middleware: clientCredentialsMiddleware ? [clientCredentialsMiddleware()] : [],
          path,
          port,
        });

        for (const entity of keys) {
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
