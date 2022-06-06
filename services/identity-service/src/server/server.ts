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
  AddressRepository,
  ConnectSessionCache,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  caches: [ConnectSessionCache],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keystore: {
    exposePublic: true,
    keyPairCache: true,
  },
  logger: winston,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [
    AddressRepository,
    DisplayNameRepository,
    IdentifierRepository,
    IdentityRepository,
  ],
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
  workers,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});
