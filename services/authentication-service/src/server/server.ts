import { Environment } from "@lindorm-io/common-types";
import { KeyType } from "@lindorm-io/key-pair";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { memoryDatabase, mongoConnection, redisConnection } from "../instance";
import { middleware } from "./middleware";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  MfaCookieSessionCache,
  StrategySessionCache,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "authentication service",
    platform: "NodeJS",
    version: process.env.npm_package_version,
  },
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    exposed: ["public"],
    storage: ["memory"],
    generated: configuration.server.workers ? [KeyType.EC] : [],
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
  middleware,
  mongo: [AccountRepository, BrowserLinkRepository],
  mongoConnection,
  port: configuration.server.port,
  redis: [AuthenticationSessionCache, MfaCookieSessionCache, StrategySessionCache],
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect(), redisConnection.connect()]);
  },
});
