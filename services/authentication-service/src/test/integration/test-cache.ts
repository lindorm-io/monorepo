import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../../instance";
import { winston } from "../../server/logger";
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

export const getTestCache = async (): Promise<TestCache> => {
  await redisConnection.waitForConnection();
  const client = redisConnection.client();
  const logger = winston;

  return {
    consentSessionCache: new ConsentSessionCache({ client, logger }),
    flowSessionCache: new FlowSessionCache({ client, logger }),
    keyPairCache: new KeyPairCache({ client, logger }),
    loginSessionCache: new LoginSessionCache({ client, logger }),
    logoutSessionCache: new LogoutSessionCache({ client, logger }),
    mfaCookieSessionCache: new MfaCookieSessionCache({ client, logger }),
    oidcSessionCache: new OidcSessionCache({ client, logger }),
  };
};
