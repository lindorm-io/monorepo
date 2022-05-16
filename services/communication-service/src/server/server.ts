import { Environment } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { socketBearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { keyPairOAuthJwksWorker } from "../worker";
import { logger } from "./logger";
import { redisConnection } from "../instance";
import { socketListeners } from "./socket";

export const server = createNodeServer<ServerKoaContext>({
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  issuer: configuration.server.issuer,
  logger: logger,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  workers: configuration.server.environment !== Environment.TEST ? [keyPairOAuthJwksWorker] : [],
  setup: async (): Promise<void> => {
    await redisConnection.waitForConnection();
  },

  socket: true,
  socketMiddleware: [
    socketBearerAuthMiddleware({
      issuer:
        configuration.services.oauth_service.issuer || configuration.services.oauth_service.host,
    }),
  ],
  socketListeners,
});
