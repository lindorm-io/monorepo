import {
  AxiosClientCredentialsMiddlewareOptions,
  axiosClientCredentialsMiddleware,
} from "@lindorm-io/axios";
import { Logger } from "@lindorm-io/core-logger";
import { expiryDate } from "@lindorm-io/expiry";
import { IMemoryDatabase } from "@lindorm-io/in-memory-cache";
import { StoredKeySet } from "@lindorm-io/keystore";
import { IntervalWorker } from "@lindorm-io/koa";
import { ReadableTime, ms } from "@lindorm-io/readable-time";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { StoredKeySetMemoryCache } from "../infrastructure";
import { getKeysFromJwks } from "../utils";

type Options = {
  host: string;
  port?: number;
  alias: string;
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  logger: Logger;
  memoryDatabase: IMemoryDatabase;
  path?: string;
  retry?: Partial<RetryOptions>;
  workerInterval?: ReadableTime;
};

export const storedKeySetJwksMemoryWorker = (options: Options): IntervalWorker => {
  const {
    host,
    port,
    alias,
    clientCredentials,
    memoryDatabase,
    path,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const logger = options.logger.createChildLogger(["storedKeySetJwksMemoryWorker", alias]);

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
        const memoryCache = new StoredKeySetMemoryCache(memoryDatabase, logger);

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
          await memoryCache.upsert(new StoredKeySet(key));
        }
      },
      retry,
      time: ms(workerInterval),
    },
    logger,
  );
};
