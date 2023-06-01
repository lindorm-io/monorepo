import {
  AxiosClientCredentialsMiddlewareOptions,
  AxiosClientProperties,
  axiosClientCredentialsMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { expiryDate } from "@lindorm-io/expiry";
import { IMemoryDatabase } from "@lindorm-io/in-memory-cache";
import { IntervalWorker } from "@lindorm-io/koa";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { KeyPairMemoryCache } from "../infrastructure";
import { getKeysFromJwks } from "../util";

type Options = {
  host: string;
  port?: number;
  alias: string;
  client?: Partial<AxiosClientProperties>;
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  logger: Logger;
  memoryDatabase: IMemoryDatabase;
  path?: string;
  retry?: Partial<RetryOptions>;
  workerInterval?: ReadableTime;
};

export const keyPairJwksMemoryWorker = (options: Options): IntervalWorker => {
  const {
    host,
    port,
    alias,
    client,
    clientCredentials,
    memoryDatabase,
    path,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const logger = options.logger.createChildLogger(["keyPairJwksMemoryWorker", alias]);

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
        const memoryCache = new KeyPairMemoryCache(memoryDatabase, logger);

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
          await memoryCache.upsert(entity);
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
