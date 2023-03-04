import { CryptoArgon } from "@lindorm-io/crypto";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { argon, mongoConnection, redisConnection } from "../../instance";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import {
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BrowserSessionRepository,
  ClaimsSessionCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../../infrastructure";

export let TEST_OPAQUE_TOKEN_CACHE: OpaqueTokenCache;
export let TEST_AUTHORIZATION_CODE_CACHE: AuthorizationCodeCache;
export let TEST_AUTHORIZATION_SESSION_CACHE: AuthorizationSessionCache;
export let TEST_CLAIMS_SESSION_CACHE: ClaimsSessionCache;
export let TEST_ELEVATION_SESSION_CACHE: ElevationSessionCache;
export let TEST_LOGOUT_SESSION_CACHE: LogoutSessionCache;

export let TEST_BROWSER_SESSION_REPOSITORY: BrowserSessionRepository;
export let TEST_CLIENT_REPOSITORY: ClientRepository;
export let TEST_CLIENT_SESSION_REPOSITORY: ClientSessionRepository;
export let TEST_TENANT_REPOSITORY: TenantRepository;

export let TEST_ARGON: CryptoArgon;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await mongoConnection.connect();
  await redisConnection.connect();

  TEST_OPAQUE_TOKEN_CACHE = new OpaqueTokenCache({ connection: redisConnection, logger });
  TEST_AUTHORIZATION_CODE_CACHE = new AuthorizationCodeCache({
    connection: redisConnection,
    logger,
  });
  TEST_AUTHORIZATION_SESSION_CACHE = new AuthorizationSessionCache({
    connection: redisConnection,
    logger,
  });
  TEST_CLAIMS_SESSION_CACHE = new ClaimsSessionCache({ connection: redisConnection, logger });
  TEST_ELEVATION_SESSION_CACHE = new ElevationSessionCache({ connection: redisConnection, logger });
  TEST_LOGOUT_SESSION_CACHE = new LogoutSessionCache({ connection: redisConnection, logger });

  TEST_BROWSER_SESSION_REPOSITORY = new BrowserSessionRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_CLIENT_REPOSITORY = new ClientRepository({ connection: mongoConnection, logger });
  TEST_CLIENT_SESSION_REPOSITORY = new ClientSessionRepository({
    connection: mongoConnection,
    logger,
  });
  TEST_TENANT_REPOSITORY = new TenantRepository({ connection: mongoConnection, logger });

  TEST_ARGON = argon;

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger,
  });
  await keyPairCache.create(createTestKeyPair());
};
