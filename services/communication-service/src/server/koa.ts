import { Environment, KoaApp } from "@lindorm-io/koa";
import { configuration } from "../configuration";
import { join } from "path";
import { keyPairOAuthJwksWorker } from "../worker";
import { redisConnection } from "../instance";
import { serverMiddlewares } from "../middleware";
import { winston } from "../logger";

export const koa = new KoaApp({
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  logger: winston,
  port: configuration.server.port,

  setup: async (): Promise<void> => {
    await redisConnection.waitForConnection();
  },
});

koa.addMiddlewares(serverMiddlewares);
koa.addRoutesAutomatically(join(__dirname, "..", "router"));

// workers
if (configuration.server.environment !== Environment.TEST) {
  koa.addWorker(keyPairOAuthJwksWorker);
}
