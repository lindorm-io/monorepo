import { createTestStoredKeySet } from "@lindorm-io/keystore";
import { StoredKeySetRedisRepository } from "@lindorm-io/koa-keystore";
import { createMockLogger } from "@lindorm-io/winston";
import { FederationSessionCache } from "../../infrastructure";
import { redisConnection } from "../../instance";

export let TEST_FEDERATION_SESSION_CACHE: FederationSessionCache;

export const setupIntegration = async (): Promise<void> => {
  const logger = createMockLogger();

  await redisConnection.connect();

  TEST_FEDERATION_SESSION_CACHE = new FederationSessionCache(redisConnection, logger);

  const keyPairCache = new StoredKeySetRedisRepository(redisConnection, logger);
  await keyPairCache.create(createTestStoredKeySet());
};
