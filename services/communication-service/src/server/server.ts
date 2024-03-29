import { Environment, SubjectHint } from "@lindorm-io/common-enums";
import { socketBearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { memoryDatabase, redisConnection } from "../instance";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { logger } from "./logger";
import { socketListeners } from "./socket";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "communication service",
    platform: "NodeJS",
    version: process.env.npm_package_version,
  },
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
  startWorkers: configuration.server.workers,

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
