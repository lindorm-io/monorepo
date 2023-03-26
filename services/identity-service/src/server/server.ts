import { Environment } from "@lindorm-io/common-types";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import { logger } from "./logger";
import { memoryDatabase, mongoConnection } from "../instance";
import {
  AddressRepository,
  DisplayNameRepository,
  IdentifierRepository,
  IdentityRepository,
} from "../infrastructure";

export const server = createNodeServer<ServerKoaContext>({
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

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect()]);
  },
});
