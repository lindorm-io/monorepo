import { Environment, KoaApp } from "@lindorm-io/koa";
import { configuration } from "../configuration";
import { join } from "path";
import { mongoConnection, redisConnection } from "../instance";
import { serverMiddlewares } from "../middleware";
import { winston } from "../logger";
import {
  keyPairCacheWorker,
  keyPairCleanupWorker,
  keyPairDeviceJwksWorker,
  keyPairOAuthJwksWorker,
  keyPairRotationWorker,
  oidcProvidersJwksWorkers,
} from "../worker";

export const koa = new KoaApp({
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  keys: configuration.cookies.keys,
  logger: winston,
  port: configuration.server.port,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});

koa.addMiddlewares(serverMiddlewares);
koa.addRoutesAutomatically(join(__dirname, "..", "router"));

// workers
if (configuration.server.environment !== Environment.TEST) {
  koa.addWorker(keyPairRotationWorker);
  koa.addWorker(keyPairCacheWorker);
  koa.addWorker(keyPairCleanupWorker);

  koa.addWorker(keyPairOAuthJwksWorker);
  koa.addWorker(keyPairDeviceJwksWorker);

  for (const worker of oidcProvidersJwksWorkers) {
    koa.addWorker(worker);
  }
}
