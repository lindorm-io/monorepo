import { ILogger } from "@lindorm-io/winston";
import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { RedisConnection } from "@lindorm-io/redis";
import { addSeconds } from "date-fns";
import { getExpiryDate, RetryOptions, stringToSeconds } from "@lindorm-io/core";
import { getKeysFromJwks } from "../util";
import {
  Axios,
  axiosClientCredentialsMiddleware,
  AxiosClientCredentialsMiddlewareOptions,
} from "@lindorm-io/axios";

type OAuthServiceOptions = {
  host: string;
  port?: number;
};

type VaultServiceOptions = {
  host: string;
  path?: string;
  port?: number;
};

type Options = {
  clientCredentials: AxiosClientCredentialsMiddlewareOptions;
  oauthService: OAuthServiceOptions;
  redisConnection: RedisConnection;
  retry?: Partial<RetryOptions>;
  vaultService: VaultServiceOptions;
  logger: ILogger;
  workerInterval?: string;
};

export const keyPairVaultCacheWorker = (options: Options): IntervalWorker => {
  const {
    clientCredentials,
    oauthService,
    redisConnection,
    retry,
    vaultService,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const time = workerIntervalInSeconds * 1000;
  const logger = options.logger.createChildLogger(["keyPairVaultCacheWorker"]);

  logger.debug("creating vault cache worker", {
    oauthService,
    vaultService,
    workerInterval,
  });

  const oauthClient = new Axios(
    {
      host: oauthService.host,
      name: "oauthClient",
      port: oauthService.port,
    },
    logger,
  );

  const clientCredentialsMiddleware = axiosClientCredentialsMiddleware(clientCredentials);

  return new IntervalWorker(
    {
      callback: async (): Promise<void> => {
        const cache = new KeyPairCache({ connection: redisConnection, logger });

        const keys = await getKeysFromJwks({
          logger,
          host: vaultService.host,
          middleware: [clientCredentialsMiddleware(oauthClient)],
          path: vaultService.path || "/internal/jwks",
          port: vaultService.port,
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
