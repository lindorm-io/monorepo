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
import { middleware } from "./middleware";

export const server = createNodeServer<ServerKoaContext>({
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  logger: winston,
  middleware,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
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
