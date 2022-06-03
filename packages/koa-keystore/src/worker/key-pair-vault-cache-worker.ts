import { IntervalWorker } from "@lindorm-io/koa";
import { KeyPairCache } from "../infrastructure";
import { Keystore } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";
import { RedisConnection } from "@lindorm-io/redis";
import { WebKeyHandler } from "../class";
import { stringToSeconds } from "@lindorm-io/core";
import {
  Axios,
  axiosClientCredentialsMiddleware,
  AxiosClientCredentialsMiddlewareConfig,
} from "@lindorm-io/axios";

interface OAuthServiceOptions {
  host: string;
  port?: number;
}

interface VaultServiceOptions {
  host: string;
  path?: string;
  port?: number;
}

interface Options {
  clientCredentials: AxiosClientCredentialsMiddlewareConfig;
  oauthService: OAuthServiceOptions;
  redisConnection: RedisConnection;
  retry?: number;
  scopes?: Array<string>;
  vaultService: VaultServiceOptions;
  winston: ILogger;
  workerInterval?: string;
}

export const keyPairVaultCacheWorker = (options: Options): IntervalWorker => {
  const {
    clientCredentials,
    oauthService,
    redisConnection,
    retry = 3,
    scopes = ["lindorm.io/vault-service/client/jwks-private:read"],
    vaultService,
    winston,
    workerInterval = "5 minutes",
  } = options;

  const workerIntervalInSeconds = stringToSeconds(workerInterval);
  const expiresInSeconds = workerIntervalInSeconds + 120;
  const time = workerIntervalInSeconds * 1000;
  const logger = winston.createChildLogger(["keyPairVaultCacheWorker"]);

  logger.debug("creating vault cache worker", {
    oauthService,
    vaultService,
    workerInterval,
  });

  const oauthClient = new Axios({
    host: oauthService.host,
    logger,
    name: "oauthClient",
    port: oauthService.port,
  });

  const clientCredentialsMiddleware = axiosClientCredentialsMiddleware(clientCredentials);

  const handler = new WebKeyHandler({
    host: vaultService.host,
    logger,
    middleware: [clientCredentialsMiddleware(oauthClient, scopes)],
    name: "vaultClient",
    path: vaultService.path || "/internal/jwks",
    port: vaultService.port,
  });

  return new IntervalWorker({
    callback: async (): Promise<void> => {
      const cache = new KeyPairCache({ connection: redisConnection, expiresInSeconds, logger });

      const array = await handler.getKeys();

      for (const entity of array) {
        const expires = Keystore.getTTL(entity);
        await cache.create(entity, expires?.seconds);
      }
    },
    logger,
    retry,
    time,
  });
};
