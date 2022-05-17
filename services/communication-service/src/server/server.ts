import { Environment } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { redisConnection } from "../instance";
import { socketBearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { socketListeners } from "./socket";
import { winston } from "./logger";
import { workers } from "./workers";

export const server = createNodeServer<ServerKoaContext>({
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  issuer: configuration.server.issuer,
  logger: winston,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  workers,
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
