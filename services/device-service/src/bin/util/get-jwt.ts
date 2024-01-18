import { JWT } from "@lindorm-io/jwt";
import { Keystore } from "@lindorm-io/keystore";
import { StoredKeySetRedisRepository } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { configuration } from "../../server/configuration";
import { logger } from "./logger";

export const getJwt = async (): Promise<JWT> => {
  const cache = new StoredKeySetRedisRepository(redisConnection, logger);
  const keys = await cache.findMany({});

  return new JWT({ issuer: configuration.server.issuer }, new Keystore(keys, logger), logger);
};
