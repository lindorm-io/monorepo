import { CryptoArgon } from "@lindorm-io/crypto";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { argon, mongoConnection, redisConnection } from "../../instance";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import {
  AuthorizationSessionCache,
  ClientCache,
  ClientRepository,
  ConsentSessionRepository,
  BrowserSessionRepository,
  InvalidTokenCache,
  LogoutSessionCache,
  RefreshSessionRepository,
} from "../../infrastructure";

export let TEST_AUTHORIZATION_SESSION_CACHE: AuthorizationSessionCache;
export let TEST_CLIENT_CACHE: ClientCache;
export let TEST_INVALID_TOKEN_CACHE: InvalidTokenCache;
export let TEST_LOGOUT_SESSION_CACHE: LogoutSessionCache;

export let TEST_BROWSER_SESSION_REPOSITORY: BrowserSessionRepository;
export let TEST_CLIENT_REPOSITORY: ClientRepository;
export let TEST_CONSENT_SESSION_REPOSITORY: ConsentSessionRepository;
export let TEST_REFRESH_SESSION_REPOSITORY: RefreshSessionRepository;

export let TEST_ARGON: CryptoArgon;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  TEST_AUTHORIZATION_SESSION_CACHE = new AuthorizationSessionCache({
    connection: redisConnection,
    logger,
  });
  TEST_CLIENT_CACHE = new ClientCache({ connection: redisConnection, logger });
  TEST_INVALID_TOKEN_CACHE = new InvalidTokenCache({ connection: redisConnection, logger });
  TEST_LOGOUT_SESSION_CACHE = new LogoutSessionCache({ connection: redisConnection, logger });

  TEST_BROWSER_SESSION_REPOSITORY = new BrowserSessionRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_CLIENT_REPOSITORY = new ClientRepository({ connection: mongoConnection, logger });
  TEST_CONSENT_SESSION_REPOSITORY = new ConsentSessionRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_REFRESH_SESSION_REPOSITORY = new RefreshSessionRepository({
    connection: mongoConnection,
    logger,
  });

  TEST_ARGON = argon;

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
