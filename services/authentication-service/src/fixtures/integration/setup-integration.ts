import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { mongoConnection, redisConnection } from "../../instance";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  ConsentSessionCache,
  LoginSessionCache,
  LogoutSessionCache,
  MfaCookieSessionCache,
  StrategySessionCache,
} from "../../infrastructure";

export let TEST_ACCOUNT_REPOSITORY: AccountRepository;
export let TEST_AUTHENTICATION_SESSION_CACHE: AuthenticationSessionCache;
export let TEST_BROWSER_LINK_REPOSITORY: BrowserLinkRepository;
export let TEST_CONSENT_SESSION_CACHE: ConsentSessionCache;
export let TEST_LOGIN_SESSION_CACHE: LoginSessionCache;
export let TEST_LOGOUT_SESSION_CACHE: LogoutSessionCache;
export let TEST_MFA_COOKIE_SESSION_CACHE: MfaCookieSessionCache;
export let TEST_STRATEGY_SESSION_CACHE: StrategySessionCache;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_ACCOUNT_REPOSITORY = new AccountRepository({ connection: mongoConnection, logger });
  TEST_AUTHENTICATION_SESSION_CACHE = new AuthenticationSessionCache({
    connection: redisConnection,
    logger,
  });
  TEST_BROWSER_LINK_REPOSITORY = new BrowserLinkRepository({ connection: mongoConnection, logger });
  TEST_CONSENT_SESSION_CACHE = new ConsentSessionCache({ connection: redisConnection, logger });
  TEST_LOGIN_SESSION_CACHE = new LoginSessionCache({ connection: redisConnection, logger });
  TEST_LOGOUT_SESSION_CACHE = new LogoutSessionCache({ connection: redisConnection, logger });
  TEST_MFA_COOKIE_SESSION_CACHE = new MfaCookieSessionCache({
    connection: redisConnection,
    logger,
  });
  TEST_STRATEGY_SESSION_CACHE = new StrategySessionCache({
    connection: redisConnection,
    logger,
  });

  const keyPairCache = new KeyPairCache({ connection: redisConnection, logger });
  await keyPairCache.create(createTestKeyPair());
};
