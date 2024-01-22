import { Environment } from "@lindorm-io/common-enums";
import { createNodeServer } from "@lindorm-io/node-server";
import { join } from "path";
import {
  EncryptedRecordRepository,
  EncryptionKeyRepository,
  ProtectedRecordRepository,
} from "../infrastructure";
import { mongoConnection, redisConnection } from "../instance";
import { ServerKoaContext } from "../types";
import { configuration } from "./configuration";
import { logger } from "./logger";

export const server = createNodeServer<ServerKoaContext>({
  client: {
    id: configuration.oauth.client_id,
    environment: configuration.server.environment,
    name: "vault service",
    platform: "NodeJS",
    version: process.env.npm_package_version,
  },
  domain: configuration.server.domain,
  environment: configuration.server.environment as Environment,
  host: configuration.server.host,
  issuer: configuration.server.issuer,
  keystore: {
    encOptions: {
      algorithm: "RS512",
      modulus: 4,
      type: "RSA",
      use: "enc",
    },
    sigOptions: {
      algorithm: "ES512",
      curve: "P-521",
      type: "EC",
      use: "sig",
    },
    exportKeys: "public",
    exportExternalKeys: false,
    jwks: [
      {
        host: configuration.services.oauth_service.host,
        port: configuration.services.oauth_service.port,
        name: configuration.services.oauth_service.client_name,
      },
    ],
    storage: ["redis"],
  },
  logger,
  mongo: [EncryptedRecordRepository, EncryptionKeyRepository, ProtectedRecordRepository],
  mongoConnection,
  port: configuration.server.port,
  redisConnection,
  routerDirectory: join(__dirname, "..", "router"),
  services: Object.values(configuration.services).map((service) => ({
    name: service.client_name,
    host: service.host,
    port: service.port,
  })),
  startWorkers: configuration.server.workers,

  setup: async (): Promise<void> => {
    await Promise.all([mongoConnection.connect(), redisConnection.connect()]);
  },
});
