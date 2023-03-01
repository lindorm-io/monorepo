import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
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

type VaultServiceOptions = {
  host: string;
  path?: string;
  port?: number;
};

type Options = {
  clientCredentials: AxiosClientCredentialsMiddlewareOptions;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  vaultService: VaultServiceOptions;
  logger: Logger;
  workerInterval?: string;
};

export const keyPairVaultCacheWorker = (options: Options): IntervalWorker => {
  const {
    clientCredentials,
    redisConnection,
    retry,
    vaultService,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairVaultCacheWorker"]);

  logger.debug("creating vault cache worker", {
    vaultService,
    workerInterval,
  });

  const clientCredentialsMiddleware = axiosClientCredentialsMiddleware(clientCredentials);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const cache = new KeyPairCache({ connection: redisConnection, logger });

        const keys = await getKeysFromJwks({
          host: vaultService.host,
          logger,
          middleware: [clientCredentialsMiddleware()],
          path: vaultService.path || "/internal/jwks",
          port: vaultService.port,
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
