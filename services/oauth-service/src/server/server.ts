import { Environment } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { middleware } from "./middleware";
import { memoryDatabase, mongoConnection, redisConnection } from "../instance";
import { workers } from "./workers";
import { KeyType } from "@lindorm-io/key-pair";
import {
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClaimsSessionCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "oauth service",
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
  },
  logger,
  memoryDatabase,
  middleware,
  mongo: [BrowserSessionRepository, ClientRepository, ClientSessionRepository, TenantRepository],
  mongoConnection,
  port: configuration.server.port,
  redis: [
    OpaqueTokenCache,
    AuthorizationCodeCache,
    AuthorizationSessionCache,
    ClaimsSessionCache,
    ElevationSessionCache,
    LogoutSessionCache,
  ],
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
  workers,

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect(), redisConnection.connect()]);
  },
});
