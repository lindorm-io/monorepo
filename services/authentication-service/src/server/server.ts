import { Environment } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { middleware } from "./middleware";
import { memoryDatabase, mongoConnection, redisConnection } from "../instance";
import { workers } from "./workers";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  MfaCookieSessionCache,
  StrategySessionCache,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    exposePublic: true,
    keyPairMemory: true,
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
  workers,

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect(), redisConnection.connect()]);
  },
});
