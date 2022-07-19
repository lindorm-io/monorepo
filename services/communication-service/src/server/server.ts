import { Environment } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { SubjectHint } from "../common";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { middleware } from "./middleware";
import { redisConnection } from "../instance";
import { socketBearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { socketListeners } from "./socket";
import { workers } from "./workers";

export const server = createNodeServer<ServerKoaContext>({
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    exposePublic: true,
    keyPairCache: true,
  },
  logger,
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
    await redisConnection.connect();
  },

  socket: true,
  socketMiddleware: [
    socketBearerAuthMiddleware({
      audiences: [configuration.oauth.client_id],
      issuer: configuration.services.oauth_service.issuer,
      subjectHint: SubjectHint.IDENTITY,
    }),
  ],
  socketListeners,
  useSocketRedisAdapter: true,
});
