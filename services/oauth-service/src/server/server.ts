import { Environment } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { winston } from "./logger";
import { middleware } from "./middleware";
import { mongoConnection, redisConnection } from "../instance";
import { workers } from "./workers";
import {
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
  TenantRepository,
} from "../infrastructure";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";

export const server = createNodeServer<ServerKoaContext>({
  caches: [
    AuthorizationSessionCache,
    ClientCache,
    InvalidTokenCache,
    KeyPairCache,
    LogoutSessionCache,
  ],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  isKeyPairInRepository: true,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  logger: winston,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [
    BrowserSessionRepository,
    ClientRepository,
    ConsentSessionRepository,
    KeyPairRepository,
    RefreshSessionRepository,
    TenantRepository,
  ],
  routerDirectory: join(__dirname, "..", "router"),
  workers,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});
