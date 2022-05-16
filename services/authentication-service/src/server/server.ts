import { Environment } from "@lindorm-io/koa";
import { KeyPairCache, KeyPairRepository } from "@lindorm-io/koa-keystore";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { middleware } from "./middleware";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "./logger";
import { workers } from "./workers";
import {
  AccountRepository,
  BrowserLinkRepository,
  ConsentSessionCache,
  FlowSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
  MfaCookieSessionCache,
  OidcSessionCache,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  caches: [
    ConsentSessionCache,
    FlowSessionCache,
    KeyPairCache,
    LoginSessionCache,
    LogoutSessionCache,
    MfaCookieSessionCache,
    OidcSessionCache,
  ],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  isKeyPairInRepository: true,
  issuer: configuration.server.issuer,
  keys: configuration.cookies.keys,
  logger: winston,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [AccountRepository, BrowserLinkRepository, KeyPairRepository],
  routerDirectory: join(__dirname, "..", "router"),
  workers,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});
