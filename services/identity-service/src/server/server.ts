import { Environment } from "@lindorm-io/common-enums";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";
import { memoryDatabase, mongoConnection } from "../instance";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { logger } from "./logger";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "identity service",
    platform: "NodeJS",
    version: process.env.npm_package_version,
  },
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keystore: {
    storage: ["memory"],
    jwks: [
      {
        host: configuration.services.oauth_service.host,
        port: configuration.services.oauth_service.port,
        name: configuration.services.oauth_service.client_name,
      },
    ],
  },
  logger,
  memoryDatabase,
  mongo: [AddressRepository, DisplayNameRepository, IdentifierRepository, IdentityRepository],
  mongoConnection,
  port: configuration.server.port,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
  startWorkers: configuration.server.workers,

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect()]);
  },
});
