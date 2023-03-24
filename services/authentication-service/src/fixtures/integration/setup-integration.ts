import { CryptoArgon } from "@lindorm-io/crypto";
import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { argon, memoryDatabase, mongoConnection, redisConnection } from "../../instance";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import {
  AccountRepository,
  AuthenticationSessionCache,
  BrowserLinkRepository,
  MfaCookieSessionCache,
  StrategySessionCache,
} from "../../infrastructure";

export let TEST_ACCOUNT_REPOSITORY: AccountRepository;
export let TEST_AUTHENTICATION_SESSION_CACHE: AuthenticationSessionCache;
export let TEST_BROWSER_LINK_REPOSITORY: BrowserLinkRepository;
export let TEST_MFA_COOKIE_SESSION_CACHE: MfaCookieSessionCache;
export let TEST_STRATEGY_SESSION_CACHE: StrategySessionCache;

export let TEST_ARGON: CryptoArgon;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_ACCOUNT_REPOSITORY = new AccountRepository(mongoConnection, logger);
  TEST_AUTHENTICATION_SESSION_CACHE = new AuthenticationSessionCache(redisConnection, logger);
  TEST_BROWSER_LINK_REPOSITORY = new BrowserLinkRepository(mongoConnection, logger);
  TEST_MFA_COOKIE_SESSION_CACHE = new MfaCookieSessionCache(redisConnection, logger);
  TEST_STRATEGY_SESSION_CACHE = new StrategySessionCache(redisConnection, logger);

  TEST_ARGON = argon;

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
