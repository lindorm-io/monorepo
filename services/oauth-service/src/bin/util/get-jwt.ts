import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { Keystore } from "@lindorm-io/key-pair";
import { JWT } from "@lindorm-io/jwt";
import { configuration } from "../../server/configuration";
import { redisConnection } from "../../instance";
import { logger } from "./logger";

export const getJwt = async (): Promise<JWT> => {
  const cache = new KeyPairCache({ connection: redisConnection, logger });
  const keys = await cache.findMany({});
  const keystore = new Keystore({ keys });

  return new JWT({ issuer: configuration.server.issuer }, keystore, logger);
};
