import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { logger } from "../logger";
import { redisConnection } from "../../instance";
import {
  ConsentSessionCache,
  FlowSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
  MfaCookieSessionCache,
  OidcSessionCache,
} from "../../infrastructure";

interface TestCache {
  consentSessionCache: ConsentSessionCache;
  flowSessionCache: FlowSessionCache;
  keyPairCache: KeyPairCache;
  loginSessionCache: LoginSessionCache;
  logoutSessionCache: LogoutSessionCache;
  mfaCookieSessionCache: MfaCookieSessionCache;
  oidcSessionCache: OidcSessionCache;
}

export const getTestCache = (): TestCache => ({
  consentSessionCache: new ConsentSessionCache({ connection: redisConnection, logger }),
  flowSessionCache: new FlowSessionCache({ connection: redisConnection, logger }),
  keyPairCache: new KeyPairCache({ connection: redisConnection, logger }),
  loginSessionCache: new LoginSessionCache({ connection: redisConnection, logger }),
  logoutSessionCache: new LogoutSessionCache({ connection: redisConnection, logger }),
  mfaCookieSessionCache: new MfaCookieSessionCache({
    connection: redisConnection,
    logger,
  }),
  oidcSessionCache: new OidcSessionCache({ connection: redisConnection, logger }),
});
