import { KeyPairMemoryCache } from "@lindorm-io/koa-keystore";
import { OidcSessionCache } from "../../infrastructure";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { memoryDatabase, redisConnection } from "../../instance";

export let TEST_OIDC_SESSION_CACHE: OidcSessionCache;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await redisConnection.connect();

  TEST_OIDC_SESSION_CACHE = new OidcSessionCache(redisConnection, logger);

  const keyPairCache = new KeyPairMemoryCache(memoryDatabase, logger);
  await keyPairCache.create(createTestKeyPair());
};
