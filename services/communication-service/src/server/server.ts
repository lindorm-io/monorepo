import { Environment, SubjectHint } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { memoryDatabase, redisConnection } from "../instance";
import { socketBearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { socketListeners } from "./socket";

export const server = createNodeServer<ServerKoaContext>({
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    storage: ["memory"],
    jwks: [
      {
        host: configuration.services.device_service.host,
        port: configuration.services.device_service.port,
        name: configuration.services.device_service.client_name,
      },
      {
        host: configuration.services.oauth_service.host,
        port: configuration.services.oauth_service.port,
        name: configuration.services.oauth_service.client_name,
      },
    ],
  },
  logger,
  memoryDatabase,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),

  setup: async (): Promise<void> => {
    await redisConnection.connect();
  },

  socket: true,
  socketMiddleware: [
    socketBearerAuthMiddleware({
      audience: configuration.oauth.client_id,
      issuer: configuration.services.oauth_service.issuer,
      subjectHints: [SubjectHint.IDENTITY],
    }),
  ],
  socketListeners,
  useSocketRedisAdapter: true,
});
