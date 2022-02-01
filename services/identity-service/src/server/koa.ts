import { Environment, KoaApp } from "@lindorm-io/koa";
import { configuration } from "../configuration";
import { join } from "path";
import { keyPairOAuthJwksWorker } from "../worker";
import { mongoConnection, redisConnection } from "../instance";
import { serverMiddlewares } from "../middleware";
import { winston } from "../logger";

export const koa = new KoaApp({
  host: configuration.server.host,
  port: configuration.server.port,
  logger: winston,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});

koa.addMiddlewares(serverMiddlewares);
koa.addRoutesAutomatically(join(__dirname, "..", "router"));

// workers
if (configuration.server.environment !== Environment.TEST) {
  koa.addWorker(keyPairOAuthJwksWorker);
}
