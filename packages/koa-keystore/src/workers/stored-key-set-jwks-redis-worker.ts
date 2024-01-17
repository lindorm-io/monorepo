import {
  AxiosClientCredentialsMiddlewareOptions,
  axiosClientCredentialsMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { expiryDate } from "@lindorm-io/expiry";
import { StoredKeySet } from "@lindorm-io/keystore";
import { IntervalWorker } from "@lindorm-io/koa";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { StoredKeySetRedisRepository } from "../infrastructure";
import { getKeysFromJwks } from "../utils";

type Options = {
  host: string;
  port?: number;
  alias: string;
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  logger: Logger;
  path?: string;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: ReadableTime;
};

export const storedKeySetJwksRedisWorker = (options: Options): IntervalWorker => {
  const {
    alias,
    host,
    port,
    clientCredentials,
    path,
    redisConnection,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const logger = options.logger.createChildLogger(["storedKeySetJwksRedisWorker", alias]);

  logger.debug("creating jwks cache worker", {
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
        const redisRepository = new StoredKeySetRedisRepository(redisConnection, logger);

        const keys = await getKeysFromJwks(
          {
            host,
            port,
            alias,
            middleware: clientCredentialsMiddleware ? [clientCredentialsMiddleware()] : [],
            path,
          },
          logger,
        );

        for (const key of keys) {
          if (!key.expiresAt) {
            key.expiresAt = addSeconds(expiryDate(workerInterval), 15);
          }
          await redisRepository.upsert(new StoredKeySet(key));
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
