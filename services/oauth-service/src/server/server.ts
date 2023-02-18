import { Environment } from "@lindorm-io/common-types";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { middleware } from "./middleware";
import { mongoConnection, redisConnection } from "../instance";
import { workers } from "./workers";
import {
  AccessSessionRepository,
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ElevationSessionCache,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
  TenantRepository,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  caches: [
    AuthorizationCodeCache,
    AuthorizationSessionCache,
    ClientCache,
    ElevationSessionCache,
    InvalidTokenCache,
    KeyPairCache,
    LogoutSessionCache,
  ],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    exposePublic: true,
    keyPairCache: true,
    keyPairRepository: true,
  },
  logger,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [
    AccessSessionRepository,
    BrowserSessionRepository,
    ClientRepository,
    KeyPairRepository,
    RefreshSessionRepository,
    TenantRepository,
  ],
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
