import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { logger } from "../logger";
import {
  AuthorizationSessionCache,
  ClientCache,
  InvalidTokenCache,
  LogoutSessionCache,
} from "../../infrastructure";

interface TestCache {
  authorizationSessionCache: AuthorizationSessionCache;
  clientCache: ClientCache;
  invalidTokenCache: InvalidTokenCache;
  logoutSessionCache: LogoutSessionCache;
  keyPairCache: KeyPairCache;
}

export const getTestCache = async (): Promise<TestCache> => {
  await redisConnection.waitForConnection();
  const client = redisConnection.client();

  return {
    authorizationSessionCache: new AuthorizationSessionCache({ client, logger }),
    clientCache: new ClientCache({ client, logger }),
    invalidTokenCache: new InvalidTokenCache({ client, logger }),
    logoutSessionCache: new LogoutSessionCache({ client, logger }),
    keyPairCache: new KeyPairCache({ client, logger }),
  };
};
