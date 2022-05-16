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
  isKeyPairCached: true,
  isKeyPairInRepository: true,
  issuer: configuration.server.issuer,
  logger: winston,
  middleware,
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  repositories: [DeviceLinkRepository],
  routerDirectory: join(__dirname, "..", "router"),
  workers,

  setup: async (): Promise<void> => {
    await mongoConnection.waitForConnection();
    await redisConnection.waitForConnection();
  },
});
