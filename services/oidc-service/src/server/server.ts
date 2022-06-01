import { Environment } from "@lindorm-io/koa";
import { OidcSessionCache } from "../infrastructure";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { middleware } from "./middleware";
import { redisConnection } from "../instance";
import { winston } from "./logger";
import { workers } from "./workers";

export const server = createNodeServer<ServerKoaContext>({
  caches: [OidcSessionCache],
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keys: configuration.server.keys,
  keystore: {
    keyPairCache: true,
  },
  logger: winston,
  middleware,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
  workers,

  setup: async (): Promise<void> => {
    await redisConnection.waitForConnection();
  },
});
