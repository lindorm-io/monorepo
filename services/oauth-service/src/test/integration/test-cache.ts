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

export const getTestCache = (): TestCache => ({
  authorizationSessionCache: new AuthorizationSessionCache({ connection: redisConnection, logger }),
  clientCache: new ClientCache({ connection: redisConnection, logger }),
  invalidTokenCache: new InvalidTokenCache({ connection: redisConnection, logger }),
  logoutSessionCache: new LogoutSessionCache({ connection: redisConnection, logger }),
  keyPairCache: new KeyPairCache({ connection: redisConnection, logger }),
});
