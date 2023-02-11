import { Environment } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { middleware } from "./middleware";
import { mongoConnection, redisConnection } from "../instance";
import { logger } from "./logger";
import { workers } from "./workers";
import {
  ChallengeSessionCache,
  DeviceLinkRepository,
  EnrolmentSessionCache,
  RdcSessionCache,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
  caches: [ChallengeSessionCache, EnrolmentSessionCache, RdcSessionCache],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
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
  repositories: [DeviceLinkRepository],
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
