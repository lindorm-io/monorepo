import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { OidcSessionCache } from "../../infrastructure";
import { getTestKeyPairEC } from "./test-key-pair";
import { logger } from "../logger";
import { redisConnection } from "../../instance";

export let TEST_OIDC_SESSION_CACHE: OidcSessionCache;

export const setupIntegration = async (): Promise<void> => {
  TEST_OIDC_SESSION_CACHE = new OidcSessionCache({
    connection: redisConnection,
    logger,
  });

  const keyPairCache = new KeyPairCache({ connection: redisConnection, logger });
  await keyPairCache.create(getTestKeyPairEC());
};
