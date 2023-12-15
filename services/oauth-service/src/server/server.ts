import { Environment } from "@lindorm-io/common-enums";
import { KeyPairType } from "@lindorm-io/key-pair";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import {
  AuthenticationTokenSessionCache,
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BackchannelSessionCache,
  BrowserSessionRepository,
  ClaimsSessionCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../infrastructure";
import { memoryDatabase, mongoConnection, redisConnection } from "../instance";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { logger } from "./logger";
import { middleware } from "./middleware";
import { workers } from "./workers";

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
    generated: configuration.server.workers ? [KeyPairType.EC] : [],
  },
  logger,
  memoryDatabase,
  middleware,
  mongo: [BrowserSessionRepository, ClientRepository, ClientSessionRepository, TenantRepository],
  mongoConnection,
  port: configuration.server.port,
  redis: [
    AuthenticationTokenSessionCache,
    AuthorizationCodeCache,
    AuthorizationSessionCache,
    BackchannelSessionCache,
    ClaimsSessionCache,
    ElevationSessionCache,
    LogoutSessionCache,
    OpaqueTokenCache,
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
