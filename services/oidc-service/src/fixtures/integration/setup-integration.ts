import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { OidcSessionCache } from "../../infrastructure";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { redisConnection } from "../../instance";

export let TEST_OIDC_SESSION_CACHE: OidcSessionCache;

export const setupIntegration = async (): Promise<void> => {
  TEST_OIDC_SESSION_CACHE = new OidcSessionCache({
    connection: redisConnection,
    logger: createMockLogger(),
  });

  const keyPairCache = new KeyPairCache({
    connection: redisConnection,
    logger: createMockLogger(),
  });
  await keyPairCache.create(createTestKeyPair());
};
