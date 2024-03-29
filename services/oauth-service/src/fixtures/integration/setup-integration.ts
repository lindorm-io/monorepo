import { CryptoArgon } from "@lindorm-io/crypto";
import { createTestStoredKeySet } from "@lindorm-io/keystore";
import { StoredKeySetRedisRepository } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import {
  AuthenticationTokenSessionCache,
  AuthorizationCodeCache,
  AuthorizationSessionCache,
  BackchannelSessionCache,
  BrowserSessionRepository,
  ClaimsSessionCache,
  ClientRepository,
  ClientSessionRepository,
  ElevationSessionCache,
  LogoutSessionCache,
  OpaqueTokenCache,
  TenantRepository,
} from "../../infrastructure";
import { argon, mongoConnection, redisConnection } from "../../instance";

export let TEST_AUTHENTICATION_TOKEN_SESSION_CACHE: AuthenticationTokenSessionCache;
export let TEST_OPAQUE_TOKEN_CACHE: OpaqueTokenCache;
export let TEST_AUTHORIZATION_CODE_CACHE: AuthorizationCodeCache;
export let TEST_AUTHORIZATION_SESSION_CACHE: AuthorizationSessionCache;
export let TEST_BACKCHANNEL_SESSION_CACHE: BackchannelSessionCache;
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

  TEST_AUTHENTICATION_TOKEN_SESSION_CACHE = new AuthenticationTokenSessionCache(
    redisConnection,
    logger,
  );
  TEST_OPAQUE_TOKEN_CACHE = new OpaqueTokenCache(redisConnection, logger);
  TEST_AUTHORIZATION_CODE_CACHE = new AuthorizationCodeCache(redisConnection, logger);
  TEST_AUTHORIZATION_SESSION_CACHE = new AuthorizationSessionCache(redisConnection, logger);
  TEST_BACKCHANNEL_SESSION_CACHE = new BackchannelSessionCache(redisConnection, logger);
  TEST_CLAIMS_SESSION_CACHE = new ClaimsSessionCache(redisConnection, logger);
  TEST_ELEVATION_SESSION_CACHE = new ElevationSessionCache(redisConnection, logger);
  TEST_LOGOUT_SESSION_CACHE = new LogoutSessionCache(redisConnection, logger);

  TEST_BROWSER_SESSION_REPOSITORY = new BrowserSessionRepository(mongoConnection, logger);
  TEST_CLIENT_REPOSITORY = new ClientRepository(mongoConnection, logger);
  TEST_CLIENT_SESSION_REPOSITORY = new ClientSessionRepository(mongoConnection, logger);
  TEST_TENANT_REPOSITORY = new TenantRepository(mongoConnection, logger);

  TEST_ARGON = argon;

  const keyPairCache = new StoredKeySetRedisRepository(redisConnection, logger);
  await keyPairCache.create(createTestStoredKeySet());
};
