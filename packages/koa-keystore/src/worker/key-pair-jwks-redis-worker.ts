import {
  AxiosClientCredentialsMiddlewareOptions,
  AxiosClientProperties,
  axiosClientCredentialsMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { expiryDate } from "@lindorm-io/expiry";
import { IntervalWorker } from "@lindorm-io/koa";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RedisConnection } from "@lindorm-io/redis";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { KeyPairRedisRepository } from "../infrastructure";
import { getKeysFromJwks } from "../util";

type Options = {
  host: string;
  port?: number;
  alias: string;
  client?: Partial<AxiosClientProperties>;
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  logger: Logger;
  path?: string;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  workerInterval?: ReadableTime;
};

export const keyPairJwksRedisWorker = (options: Options): IntervalWorker => {
  const {
    alias,
    host,
    port,
    client,
    clientCredentials,
    path,
    redisConnection,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const logger = options.logger.createChildLogger(["keyPairJwksRedisWorker", alias]);

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
        const redisRepository = new KeyPairRedisRepository(redisConnection, logger);

        const keys = await getKeysFromJwks(
          {
            host,
            port,
            alias,
            client,
            middleware: clientCredentialsMiddleware ? [clientCredentialsMiddleware()] : [],
            path,
          },
          logger,
        );

        for (const entity of keys) {
          if (!entity.expires) {
            entity.expires = addSeconds(expiryDate(workerInterval), 15);
          }
          await redisRepository.upsert(entity);
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
