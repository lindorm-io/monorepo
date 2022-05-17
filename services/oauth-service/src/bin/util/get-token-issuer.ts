import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { Keystore } from "@lindorm-io/key-pair";
import { TokenIssuer } from "@lindorm-io/jwt";
import { configuration } from "../../server/configuration";
import { redisConnection } from "../../instance";
import { logger } from "./logger";

export const getTokenIssuer = async (): Promise<TokenIssuer> => {
  await redisConnection.waitForConnection();

  const cache = new KeyPairCache({ client: redisConnection.client(), logger });
  const keys = await cache.findMany({});
  const keystore = new Keystore({ keys });

  return new TokenIssuer({ issuer: configuration.server.issuer, keystore, logger });
};
