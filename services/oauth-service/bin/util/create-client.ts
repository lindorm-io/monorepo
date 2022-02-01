import { Client, ClientAttributes } from "../../src/entity";
import { ClientCache, ClientRepository } from "../../src/infrastructure";
import { ClientType } from "../../src/enum";
import { getRandomString } from "@lindorm-io/core";
// @ts-ignore
import { getCrypto } from "./get-crypto";
// @ts-ignore
import { getLogger } from "./get-logger";
// @ts-ignore
import { getMongo } from "./get-mongo";
// @ts-ignore
import { getRedis } from "./get-redis";

export const createClient = async (attributes: Partial<ClientAttributes>): Promise<void> => {
  const logger = getLogger();
  const crypto = getCrypto();
  const mongo = getMongo(logger);
  const redis = getRedis(logger);

  await mongo.waitForConnection();
  await redis.waitForConnection();

  const repository = new ClientRepository({
    db: mongo.database(),
    logger,
  });

  const cache = new ClientCache({ client: redis.client(), logger });

  const secret = getRandomString(128);

  const client = await repository.create(
    new Client({
      active: true,
      allowed: {
        grantTypes: [],
        responseTypes: [],
        scopes: [],
      },
      description: "",
      host: "",
      logoutUri: "",
      name: "",
      owners: [],
      permissions: [],
      redirectUri: "",
      secret: await crypto.encrypt(secret),
      type: ClientType.PUBLIC,
      ...attributes,
    }),
  );

  await cache.create(client);

  logger.info("Client created", {
    client_name: client.name,
    client_id: client.id,
    client_secret: secret,
  });
};
