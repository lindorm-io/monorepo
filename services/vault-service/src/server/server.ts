import { EncryptedRecordRepository, ProtectedRecordRepository } from "../infrastructure";
import { Environment } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { middleware } from "./middleware";
import { mongoConnection, redisConnection } from "../instance";
import { winston } from "./logger";
import { workers } from "./workers";

export const server = createNodeServer<ServerKoaContext>({
  caches: [],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  isKeyPairCached: true,
  isKeyPairInRepository: true,
  issuer: configuration.server.issuer,
  logger: winston,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [EncryptedRecordRepository, ProtectedRecordRepository],
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
