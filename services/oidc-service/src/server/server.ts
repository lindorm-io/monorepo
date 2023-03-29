import { Environment } from "@lindorm-io/common-types";
import { OidcSessionCache } from "../infrastructure";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { memoryDatabase, redisConnection } from "../instance";
import { logger } from "./logger";
import { workers } from "./workers";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "oidc service",
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
        host: configuration.services.oauth_service.host,
        port: configuration.services.oauth_service.port,
        name: configuration.services.oauth_service.client_name,
      },
    ],
  },
  logger,
  memoryDatabase,
  port: configuration.server.port,
  redis: [OidcSessionCache],
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
});
