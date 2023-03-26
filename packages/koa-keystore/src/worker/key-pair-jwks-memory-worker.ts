import { IMemoryDatabase } from "@lindorm-io/in-memory-cache";
import { IntervalWorker } from "@lindorm-io/koa";
import { Logger } from "@lindorm-io/core-logger";
import { RetryOptions } from "@lindorm-io/retry";
import { addSeconds } from "date-fns";
import { expiryDate, stringToSeconds } from "@lindorm-io/expiry";
import { getKeysFromJwks } from "../util";
import { KeyPairMemoryCache } from "../infrastructure";
import {
  axiosClientCredentialsMiddleware,
  AxiosClientCredentialsMiddlewareOptions,
} from "@lindorm-io/axios";

type Options = {
  clientCredentials?: AxiosClientCredentialsMiddlewareOptions;
  clientName?: string;
  host: string;
  logger: Logger;
  memoryDatabase: IMemoryDatabase;
  path?: string;
  port?: number;
  retry?: Partial<RetryOptions>;
  workerInterval?: string;
};

export const keyPairJwksMemoryWorker = (options: Options): IntervalWorker => {
  const {
    clientCredentials,
    clientName,
    memoryDatabase,
    host,
    path,
    port,
    retry,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairJwksMemoryWorker"]);

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
        const memoryCache = new KeyPairMemoryCache(memoryDatabase, logger);

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
          await memoryCache.upsert(entity);
        }
      },
      retry,
      time,
    },
    logger,
  );
};
